# 🔐 Token-Based Authentication - Complete Code Implementation

This document shows the EXACT code for token-based authentication in your app, with line-by-line explanations.

---

## 📁 File Structure

```
backend/
├── .env                              ← 1. Store secrets
├── src/
│   ├── services/
│   │   └── agoraService.js           ← 2. Generate tokens
│   ├── modules/
│   │   └── streams/
│   │       ├── streams.controller.js ← 3. Use token service
│   │       └── streams.routes.js     ← 4. Expose endpoints
│   └── middleware/
│       └── auth.middleware.js        ← 5. User authentication
frontend/
├── .env                              ← 6. Store App ID (public)
├── src/
│   ├── services/
│   │   └── streamService.js          ← 7. Call backend
│   ├── hooks/
│   │   └── useAgora.js               ← 8. Use tokens
│   └── pages/
│       ├── StreamHostPage.jsx        ← 9. Host uses token
│       └── LivestreamPage.jsx        ← 10. Viewer uses token
```

---

# BACKEND IMPLEMENTATION

## 1. Environment Variables (.env)

**File:** `backend/.env`

```bash
# Agora Credentials (NEVER commit to Git!)
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=your_app_certificate_here

# Example:
# AGORA_APP_ID=a1b2c3d4e5f6g7h8
# AGORA_APP_CERTIFICATE=9i8h7g6f5e4d3c2b1a0
```

**Why this matters:**
- `AGORA_APP_ID` = Public (frontend needs it)
- `AGORA_APP_CERTIFICATE` = **SECRET** (backend only, NEVER expose)

**Security:** Add to `.gitignore`:
```bash
# .gitignore
.env
.env.local
.env.production
```

---

## 2. Token Generation Service (agoraService.js)

**File:** `backend/src/services/agoraService.js`

```javascript
// Import the token builder from agora-token package
const { RtcTokenBuilder, RtcRole } = require('agora-token');

// Load secrets from environment variables
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// ============================================================
// AGORA TOKEN GENERATION SERVICE
// ============================================================
// This service generates JWT tokens for Agora authentication
// Tokens are signed with APP_CERTIFICATE (which stays secret)
// ============================================================

const agoraService = {
  
  /**
   * Generate token for HOST (Broadcaster)
   * 
   * @param {string} channelName - Channel to join (e.g., "stream_42_1234567890")
   * @param {number} uid - User ID from database
   * @returns {object} Token config object
   */
  generateHostToken: (channelName, uid) => {
    
    // STEP 1: Define role as PUBLISHER
    // PUBLISHER = can send video/audio + receive video/audio
    const role = RtcRole.PUBLISHER;
    
    // STEP 2: Set token expiration
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    // STEP 3: Build the JWT token
    // This creates a cryptographically signed token that Agora can verify
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,              // Your Agora App ID (public)
      APP_CERTIFICATE,     // Your Agora App Certificate (SECRET - only backend knows this)
      channelName,         // Which channel this token is valid for
      uid,                 // Which user this token is for
      role,                // What permissions this token grants (PUBLISHER)
      privilegeExpiredTs   // When this token expires (Unix timestamp)
    );
    
    // STEP 4: Return complete configuration
    return {
      token,               // The JWT token (long string starting with "006...")
      appId: APP_ID,       // Frontend needs this to initialize Agora SDK
      channel: channelName,// Frontend needs this to join the right channel
      uid: uid             // Frontend needs this to identify the user
    };
  },

  /**
   * Generate token for VIEWER (Subscriber)
   * 
   * @param {string} channelName - Channel to join
   * @param {number} uid - User ID from database
   * @returns {object} Token config object
   */
  generateViewerToken: (channelName, uid) => {
    
    // STEP 1: Define role as SUBSCRIBER
    // SUBSCRIBER = can ONLY receive video/audio (cannot broadcast)
    const role = RtcRole.SUBSCRIBER;
    
    // STEP 2: Set token expiration (same as host)
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    // STEP 3: Build the JWT token (same process, different role)
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,                // SUBSCRIBER role instead of PUBLISHER
      privilegeExpiredTs
    );
    
    // STEP 4: Return complete configuration
    return {
      token,
      appId: APP_ID,
      channel: channelName,
      uid: uid
    };
  }
};

// Export the service
module.exports = agoraService;
```

---

### 🔍 Deep Dive: What `buildTokenWithUid()` Does

```javascript
// This function creates a JWT token with this structure:

// JWT Header
{
  "alg": "HS256",        // Signing algorithm (HMAC SHA-256)
  "typ": "JWT"           // Token type
}

// JWT Payload (Claims)
{
  "appId": "your_app_id",
  "channelName": "stream_42_1234567890",
  "uid": 123,
  "role": 1,             // 1 = PUBLISHER, 2 = SUBSCRIBER
  "exp": 1234567890      // Expiration timestamp
}

// JWT Signature (created using APP_CERTIFICATE)
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  APP_CERTIFICATE        // This is the SECRET KEY
)

// Final token = header.payload.signature (base64 encoded)
// Example: "006a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0..."
```

**Why this is secure:**
1. ✅ Signature can only be created with APP_CERTIFICATE
2. ✅ Agora verifies signature before allowing access
3. ✅ If someone tampers with the token, signature won't match
4. ✅ Token expires automatically after 1 hour
5. ✅ Token tied to specific channel and UID (can't be reused)

---

## 3. Controller Integration (streams.controller.js)

**File:** `backend/src/modules/streams/streams.controller.js`

```javascript
const pool = require('../../config/database');
const agoraService = require('../../services/agoraService');

// ============================================================
// STREAMS CONTROLLER
// ============================================================
// Handles HTTP requests for livestreaming
// Uses agoraService to generate tokens
// ============================================================

const streamsController = {

  /**
   * START STREAM (Seller/Host)
   * POST /api/streams/:id/start
   * 
   * This is where TOKEN AUTHENTICATION happens!
   */
  startStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;  // From JWT auth middleware
      
      console.log('🎥 Starting stream:', streamId, 'for user:', hostId);
      
      // STEP 1: Verify stream exists and belongs to user
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1 AND host_id = $2',
        [streamId, hostId]
      );
      
      if (streamResult.rows.length === 0) {
        return res.status(404).json({ 
          message: 'Stream not found or unauthorized' 
        });
      }
      
      // STEP 2: Generate unique channel name
      // Format: stream_{id}_{timestamp}
      const channelName = `stream_${streamId}_${Date.now()}`;
      console.log('📺 Channel name:', channelName);
      
      // STEP 3: 🔐 GENERATE AGORA TOKEN (TOKEN AUTHENTICATION!)
      const agoraConfig = agoraService.generateHostToken(
        channelName,  // Channel to join
        hostId        // User's ID
      );
      
      console.log('🔑 Generated token for host:', {
        appId: agoraConfig.appId,
        channel: agoraConfig.channel,
        uid: agoraConfig.uid,
        token: agoraConfig.token.substring(0, 20) + '...' // Log first 20 chars only
      });
      
      // STEP 4: Save channel info to database
      await pool.query(
        `UPDATE streams 
         SET status = 'live',
             started_at = NOW(),
             agora_channel_name = $1,
             agora_token = $2
         WHERE id = $3`,
        [channelName, agoraConfig.token, streamId]
      );
      
      // STEP 5: Return token to frontend
      // Frontend will use this token to authenticate with Agora
      res.json({
        message: 'Stream started successfully',
        streamId: streamId,
        agora: agoraConfig  // Contains: { token, appId, channel, uid }
      });
      
      console.log('✅ Stream started successfully');
      
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      next(error);
    }
  },

  /**
   * JOIN STREAM (Viewer)
   * POST /api/streams/:id/join
   * 
   * This is where VIEWER TOKEN AUTHENTICATION happens!
   */
  joinStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const viewerId = req.user.id;  // From JWT auth middleware
      
      console.log('👁️  Viewer joining stream:', streamId, 'user:', viewerId);
      
      // STEP 1: Get stream details
      const streamResult = await pool.query(
        `SELECT agora_channel_name, host_id 
         FROM streams 
         WHERE id = $1 AND status = 'live'`,
        [streamId]
      );
      
      if (streamResult.rows.length === 0) {
        return res.status(404).json({ 
          message: 'Stream not found or not live' 
        });
      }
      
      const { agora_channel_name, host_id } = streamResult.rows[0];
      
      // STEP 2: Prevent host from joining as viewer
      if (host_id === viewerId) {
        return res.status(400).json({ 
          message: 'Host cannot join as viewer' 
        });
      }
      
      // STEP 3: 🔐 GENERATE VIEWER TOKEN (TOKEN AUTHENTICATION!)
      const agoraConfig = agoraService.generateViewerToken(
        agora_channel_name,  // Same channel as host
        viewerId             // Viewer's ID
      );
      
      console.log('🔑 Generated token for viewer:', {
        appId: agoraConfig.appId,
        channel: agoraConfig.channel,
        uid: agoraConfig.uid,
        token: agoraConfig.token.substring(0, 20) + '...'
      });
      
      // STEP 4: Return token to frontend
      res.json({
        message: 'Joined stream successfully',
        streamId: streamId,
        agora: agoraConfig  // Contains: { token, appId, channel, uid }
      });
      
      console.log('✅ Viewer joined successfully');
      
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      next(error);
    }
  }
};

module.exports = streamsController;
```

---

## 4. Routes (streams.routes.js)

**File:** `backend/src/modules/streams/streams.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const streamsController = require('./streams.controller');

// ============================================================
// STREAM ROUTES
// ============================================================

// All routes require authentication (JWT token in header)
// This ensures we know WHO is requesting an Agora token

/**
 * Start a stream (generate HOST token)
 * POST /api/streams/:id/start
 * 
 * Headers: Authorization: Bearer <jwt_token>
 * Response: { agora: { token, appId, channel, uid } }
 */
router.post(
  '/:id/start',
  authMiddleware,  // Verifies JWT, adds req.user
  streamsController.startStream
);

/**
 * Join a stream (generate VIEWER token)
 * POST /api/streams/:id/join
 * 
 * Headers: Authorization: Bearer <jwt_token>
 * Response: { agora: { token, appId, channel, uid } }
 */
router.post(
  '/:id/join',
  authMiddleware,  // Verifies JWT, adds req.user
  streamsController.joinStream
);

module.exports = router;
```

---

## 5. Auth Middleware (JWT Verification)

**File:** `backend/src/middleware/auth.middleware.js`

```javascript
const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * 
 * Verifies JWT token in Authorization header
 * Extracts user ID and attaches to req.user
 * 
 * This ensures we know WHO is requesting an Agora token
 */
const authMiddleware = async (req, res, next) => {
  try {
    // STEP 1: Get token from Authorization header
    // Format: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5..."
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'No token provided' 
      });
    }
    
    // Extract token (remove "Bearer " prefix)
    const token = authHeader.split(' ')[1];
    
    // STEP 2: Verify JWT token
    // This checks:
    // - Token signature is valid (signed with JWT_SECRET)
    // - Token hasn't expired
    // - Token structure is correct
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // STEP 3: Attach user to request
    // Now controllers can access req.user.id
    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email
    };
    
    // STEP 4: Continue to next middleware/controller
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token' 
      });
    }
    return res.status(401).json({ 
      message: 'Authentication failed' 
    });
  }
};

module.exports = authMiddleware;
```

---

# FRONTEND IMPLEMENTATION

## 6. Frontend Environment Variables

**File:** `frontend/.env`

```bash
# Agora App ID (PUBLIC - safe to include)
REACT_APP_AGORA_APP_ID=your_app_id_here

# Backend URL
REACT_APP_API_URL=http://localhost:5000

# NOTE: Never put AGORA_APP_CERTIFICATE here!
# Certificates must stay on backend only.
```

---

## 7. Frontend Service (API Calls)

**File:** `frontend/src/services/streamService.js`

```javascript
import api from './api'; // Axios instance with base URL

// ============================================================
// STREAM SERVICE
// ============================================================
// Makes API calls to backend to get Agora tokens
// ============================================================

export const streamService = {
  
  /**
   * Start a stream (get HOST token)
   * 
   * Calls: POST /api/streams/:id/start
   * Returns: { agora: { token, appId, channel, uid } }
   */
  startStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/start`);
    return response.data;
  },
  
  /**
   * Join a stream (get VIEWER token)
   * 
   * Calls: POST /api/streams/:id/join
   * Returns: { agora: { token, appId, channel, uid } }
   */
  joinStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/join`);
    return response.data;
  }
};
```

**Note:** The `api` instance automatically includes JWT token in headers:

```javascript
// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
});

// Add JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## 8. Agora Hook (Uses Tokens)

**File:** `frontend/src/hooks/useAgora.js`

```javascript
import { useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

export const useAgora = () => {
  const [client] = useState(() => 
    AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
  );
  
  const [localTracks, setLocalTracks] = useState({
    videoTrack: null,
    audioTrack: null
  });
  
  /**
   * Join as Host (Broadcaster)
   * 
   * @param {string} channel - Channel name from backend
   * @param {string} token - Agora token from backend (TOKEN AUTHENTICATION!)
   * @param {number} uid - User ID from backend
   */
  const joinAsHost = useCallback(async (channel, token, uid) => {
    try {
      console.log('🎥 Joining as host...');
      
      // STEP 1: Set role to host
      await client.setClientRole('host');
      
      // STEP 2: 🔐 JOIN WITH TOKEN (TOKEN AUTHENTICATION!)
      // This is where we USE the token from backend
      const assignedUid = await client.join(
        process.env.REACT_APP_AGORA_APP_ID,  // App ID (public)
        channel,                              // Channel name
        token,                                // TOKEN (proves we're authorized)
        uid                                   // Our user ID
      );
      
      console.log('✅ Joined with UID:', assignedUid);
      
      // STEP 3: Create local tracks
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
      ]);
      
      setLocalTracks({ videoTrack, audioTrack });
      
      // STEP 4: Publish tracks
      await client.publish([audioTrack, videoTrack]);
      
      console.log('✅ Publishing video and audio');
      
    } catch (error) {
      console.error('❌ Failed to join as host:', error);
      throw error;
    }
  }, [client]);
  
  /**
   * Join as Viewer (Subscriber)
   * 
   * @param {string} channel - Channel name from backend
   * @param {string} token - Agora token from backend (TOKEN AUTHENTICATION!)
   * @param {number} uid - User ID from backend
   */
  const joinAsViewer = useCallback(async (channel, token, uid) => {
    try {
      console.log('👁️  Joining as viewer...');
      
      // STEP 1: Set role to audience
      await client.setClientRole('audience');
      
      // STEP 2: 🔐 JOIN WITH TOKEN (TOKEN AUTHENTICATION!)
      const assignedUid = await client.join(
        process.env.REACT_APP_AGORA_APP_ID,
        channel,
        token,      // TOKEN (proves we're authorized as viewer)
        uid
      );
      
      console.log('✅ Joined with UID:', assignedUid);
      
    } catch (error) {
      console.error('❌ Failed to join as viewer:', error);
      throw error;
    }
  }, [client]);
  
  return {
    client,
    localTracks,
    joinAsHost,
    joinAsViewer
  };
};
```

---

## 9. Host Page (Uses Host Token)

**File:** `frontend/src/pages/StreamHostPage.jsx`

```javascript
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';

function StreamHostPage() {
  const { id: streamId } = useParams();
  const { joinAsHost, localTracks, leave } = useAgora();
  const videoRef = useRef(null);
  
  useEffect(() => {
    const startBroadcasting = async () => {
      try {
        console.log('🚀 Starting stream...');
        
        // STEP 1: 🔐 GET TOKEN FROM BACKEND
        // This is the TOKEN AUTHENTICATION request!
        const response = await streamService.startStream(streamId);
        
        // Backend returns:
        // {
        //   agora: {
        //     token: "006abc123...",
        //     appId: "your_app_id",
        //     channel: "stream_42_1234567890",
        //     uid: 123
        //   }
        // }
        const { token, appId, channel, uid } = response.agora;
        
        console.log('🔑 Received token from backend:', {
          appId,
          channel,
          uid,
          tokenLength: token.length
        });
        
        // STEP 2: 🔐 USE TOKEN TO JOIN AGORA
        // The token proves we're authorized to broadcast
        await joinAsHost(channel, token, uid);
        
        console.log('✅ Now broadcasting!');
        
      } catch (error) {
        console.error('❌ Failed to start broadcasting:', error);
        
        // Handle specific errors
        if (error.response?.status === 401) {
          alert('Authentication failed. Please login again.');
        } else if (error.code === 'INVALID_TOKEN') {
          alert('Invalid Agora token. Please contact support.');
        } else {
          alert('Failed to start stream. Please try again.');
        }
      }
    };
    
    startBroadcasting();
    
    // Cleanup
    return () => {
      leave();
    };
  }, [streamId, joinAsHost, leave]);
  
  // Display local video preview
  useEffect(() => {
    if (localTracks.videoTrack && videoRef.current) {
      localTracks.videoTrack.play(videoRef.current, {
        mirror: true
      });
    }
  }, [localTracks]);
  
  return (
    <div>
      <h1>You're Live! 🎥</h1>
      <div 
        ref={videoRef} 
        style={{ width: 640, height: 480, background: '#000' }}
      />
    </div>
  );
}

export default StreamHostPage;
```

---

## 10. Viewer Page (Uses Viewer Token)

**File:** `frontend/src/pages/LivestreamPage.jsx`

```javascript
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';

function LivestreamPage() {
  const { id: streamId } = useParams();
  const { joinAsViewer, remoteUsers, leave } = useAgora();
  const videoRef = useRef(null);
  
  useEffect(() => {
    const joinStreamAsViewer = async () => {
      try {
        console.log('👁️  Joining stream...');
        
        // STEP 1: 🔐 GET TOKEN FROM BACKEND
        // This is the VIEWER TOKEN AUTHENTICATION request!
        const response = await streamService.joinStream(streamId);
        
        // Backend returns viewer token (SUBSCRIBER role)
        const { token, appId, channel, uid } = response.agora;
        
        console.log('🔑 Received viewer token:', {
          appId,
          channel,
          uid,
          tokenLength: token.length
        });
        
        // STEP 2: 🔐 USE TOKEN TO JOIN AGORA
        // The token proves we're authorized to watch (but not broadcast)
        await joinAsViewer(channel, token, uid);
        
        console.log('✅ Watching stream!');
        
      } catch (error) {
        console.error('❌ Failed to join stream:', error);
        
        if (error.response?.status === 401) {
          alert('Please login to watch streams.');
        } else if (error.response?.status === 404) {
          alert('Stream not found or not live.');
        } else if (error.code === 'INVALID_TOKEN') {
          alert('Invalid token. Please refresh the page.');
        } else {
          alert('Failed to join stream. Please try again.');
        }
      }
    };
    
    joinStreamAsViewer();
    
    return () => {
      leave();
    };
  }, [streamId, joinAsViewer, leave]);
  
  // Display remote video when available
  useEffect(() => {
    if (remoteUsers.length > 0 && videoRef.current) {
      const remoteUser = remoteUsers[0]; // Host
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(videoRef.current);
      }
    }
  }, [remoteUsers]);
  
  return (
    <div>
      <h1>Watching Live Stream 👁️</h1>
      <div 
        ref={videoRef} 
        style={{ width: 640, height: 480, background: '#000' }}
      />
      {remoteUsers.length === 0 && <p>Waiting for host...</p>}
    </div>
  );
}

export default LivestreamPage;
```

---

# 🔍 Complete Token Flow (Step-by-Step)

## Scenario: Seller Starts Stream

```
┌──────────┐
│  SELLER  │ 1. Clicks "Go Live"
└─────┬────┘
      │
      ▼
┌─────────────────────────────────────┐
│  StreamHostPage.jsx                 │
│  - useEffect() runs                 │
│  - Calls streamService.startStream()│
└─────────┬───────────────────────────┘
          │ 2. POST /api/streams/1/start
          │    Headers: Authorization: Bearer <user_jwt>
          ▼
┌─────────────────────────────────────┐
│  Backend: auth.middleware.js        │
│  ✓ Verify JWT token                │
│  ✓ Extract user ID (123)            │
│  ✓ Attach req.user = { id: 123 }   │
└─────────┬───────────────────────────┘
          │ 3. JWT valid, continue
          ▼
┌─────────────────────────────────────┐
│  Backend: streams.controller.js     │
│  - Check stream ownership           │
│  - Generate channel name            │
│  - Call agoraService                │
└─────────┬───────────────────────────┘
          │ 4. generateHostToken("stream_1_...", 123)
          ▼
┌─────────────────────────────────────┐
│  Backend: agoraService.js           │
│  🔐 TOKEN GENERATION:               │
│  - role = PUBLISHER                 │
│  - expires = now + 3600s            │
│  - token = JWT(                     │
│      appId,                         │
│      certificate,  ← SECRET KEY     │
│      channel,                       │
│      uid,                           │
│      role,                          │
│      expiration                     │
│    )                                │
│  - Sign with APP_CERTIFICATE        │
└─────────┬───────────────────────────┘
          │ 5. Return { token, appId, channel, uid }
          ▼
┌─────────────────────────────────────┐
│  Backend: streams.controller.js     │
│  - Save channel to database         │
│  - Return token to frontend         │
└─────────┬───────────────────────────┘
          │ 6. Response: { agora: { token: "006...", ... }}
          ▼
┌─────────────────────────────────────┐
│  Frontend: StreamHostPage.jsx       │
│  - Receive token                    │
│  - Call joinAsHost(channel, token)  │
└─────────┬───────────────────────────┘
          │ 7. joinAsHost()
          ▼
┌─────────────────────────────────────┐
│  Frontend: useAgora.js              │
│  🔐 USE TOKEN:                      │
│  - client.join(                     │
│      appId,                         │
│      channel,                       │
│      token,  ← TOKEN FROM BACKEND   │
│      uid                            │
│    )                                │
└─────────┬───────────────────────────┘
          │ 8. Connect to Agora with token
          ▼
┌─────────────────────────────────────┐
│  Agora Cloud Servers                │
│  🔐 VERIFY TOKEN:                   │
│  - Extract payload from JWT         │
│  - Verify signature with certificate│
│  - Check expiration                 │
│  - Check role = PUBLISHER           │
│  - Check channel matches            │
│  ✓ Token valid!                     │
│  ✓ Allow user to broadcast          │
└─────────────────────────────────────┘

✅ SELLER IS NOW LIVE!
```

---

# 🔐 Security Features in the Code

## 1. APP_CERTIFICATE Never Leaves Backend

```javascript
// ✅ GOOD - Backend only
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// ❌ BAD - Never do this
// const certificate = 'abc123xyz'; // Hardcoded
// const certificate = req.body.certificate; // From frontend
```

## 2. Token Has Built-in Expiration

```javascript
// Token expires after 1 hour
const expirationTimeInSeconds = 3600;
const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

// After 1 hour, Agora automatically rejects the token
```

## 3. Token Tied to Specific Channel

```javascript
const token = RtcTokenBuilder.buildTokenWithUid(
  APP_ID,
  APP_CERTIFICATE,
  channelName,  // Token ONLY works for THIS channel
  uid,
  role,
  privilegeExpiredTs
);

// User can't use this token to join other channels
```

## 4. Token Tied to Specific Role

```javascript
// Host token
const role = RtcRole.PUBLISHER;  // Can broadcast

// Viewer token
const role = RtcRole.SUBSCRIBER; // Can only watch

// Agora enforces these permissions server-side
```

## 5. User Authentication Required

```javascript
// All token requests go through JWT auth
router.post('/:id/start', authMiddleware, streamsController.startStream);
//                         ↑
//                         Verifies user is logged in

// No anonymous token generation
```

---

# 🎯 Summary

## Token-Based Authentication Implementation:

### Backend:
1. **Store secrets** in `.env` (APP_CERTIFICATE)
2. **Generate tokens** in `agoraService.js` using `RtcTokenBuilder`
3. **Verify user** with JWT middleware
4. **Return tokens** from controllers
5. **Never expose** APP_CERTIFICATE

### Frontend:
1. **Request token** from backend with JWT auth
2. **Receive token** in API response
3. **Join Agora** with token using `client.join()`
4. **Let Agora verify** token server-side

## Why This is Secure:

✅ **APP_CERTIFICATE stays on backend** (never exposed)
✅ **Tokens expire** (1 hour, then invalid)
✅ **Tokens are role-specific** (publisher vs subscriber)
✅ **Tokens are channel-specific** (can't reuse elsewhere)
✅ **User authentication required** (JWT verification)
✅ **Agora verifies everything** (signature, expiration, role)

**This is production-ready, industry-standard token-based authentication!** 🔒🚀


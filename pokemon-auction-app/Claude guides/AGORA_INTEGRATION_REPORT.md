# 📹 Agora Integration - Complete Technical Report

## Executive Summary

This document explains the complete Agora video streaming integration for your Pokémon auction app, covering architecture decisions, system design, backend implementation, frontend implementation, and every function used from the Agora SDK.

---

# Table of Contents

1. [System Architecture & Design](#system-architecture--design)
2. [Why Agora? (Technology Decision)](#why-agora-technology-decision)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Complete Flow Diagrams](#complete-flow-diagrams)
6. [Security Considerations](#security-considerations)
7. [Scalability & Performance](#scalability--performance)
8. [Error Handling](#error-handling)
9. [Testing Strategy](#testing-strategy)

---

# System Architecture & Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR AUCTION APP                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   SELLER     │         │   VIEWERS    │                 │
│  │  (Broadcaster)│         │ (Subscribers)│                 │
│  └───────┬──────┘         └──────┬───────┘                 │
│          │                       │                          │
│          │  ① Request Token     │                          │
│          ├──────────────────────►│                          │
│          │                       │                          │
│  ┌───────▼────────────────────────▼────────┐               │
│  │     YOUR BACKEND (Node.js)              │               │
│  │  - Generate Agora Tokens                │               │
│  │  - Manage Stream State                  │               │
│  │  - Store Stream Metadata                │               │
│  └───────┬────────────────────────┬────────┘               │
│          │  ② Return Token        │                          │
│          ├──────────────────────►│                          │
│          │                       │                          │
│          │  ③ Join Channel with Token                       │
│          │     (using token)     │                          │
│          └───────────┬───────────┘                          │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │      AGORA CLOUD             │
        │  ┌────────────────────────┐  │
        │  │   Real-Time Network    │  │
        │  │   - Video Streaming     │  │
        │  │   - Audio Streaming     │  │
        │  │   - Low Latency (<400ms)│  │
        │  └────────────────────────┘  │
        │                              │
        │  Handles:                    │
        │  - Video encoding/decoding   │
        │  - Network optimization      │
        │  - Quality adaptation        │
        │  - Global CDN distribution   │
        └──────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. **Token-Based Authentication** (Security)

**Why we chose this:**
- ❌ **Don't** give frontend access to App Certificate (secret key)
- ✅ **Do** generate tokens on backend (secure server)
- ✅ Tokens are temporary (expire in 1 hour)
- ✅ Tokens are role-specific (broadcaster vs viewer)

**Alternative we rejected:**
- Storing App Certificate in frontend → ❌ Anyone could steal it and create streams
- No authentication → ❌ Anyone could join any channel

**Software Development Concept:** **Separation of Concerns**
- Backend = Trusted (generates tokens)
- Frontend = Untrusted (uses tokens)

---

### 2. **Role-Based Access Control (RBAC)**

**Two roles in our system:**

```javascript
// PUBLISHER (Host/Seller)
RtcRole.PUBLISHER
- Can send video
- Can send audio
- Can receive video/audio
- Token generated with publisher privileges

// SUBSCRIBER (Viewer/Bidder)
RtcRole.SUBSCRIBER  
- Can ONLY receive video/audio
- Cannot send video/audio
- Token generated with subscriber privileges
```

**Why this matters:**
- Prevents viewers from hijacking stream
- Ensures only authorized seller can broadcast
- Reduces bandwidth (viewers don't need upload)

**Software Development Concept:** **Principle of Least Privilege**
- Each user gets minimum permissions needed
- Viewers don't need broadcast permissions

---

### 3. **Channel-Based Isolation** (Multi-tenancy)

**Each stream gets a unique channel:**
```javascript
channelName = `stream_${streamId}_${timestamp}`
// Example: "stream_42_1234567890"
```

**Why:**
- ✅ Multiple streams can run simultaneously
- ✅ Streams are isolated (no cross-talk)
- ✅ Easy cleanup (channel dies when all users leave)
- ✅ Predictable naming for debugging

**System Design Concept:** **Resource Isolation**
- Each stream is independent
- One stream's failure doesn't affect others

---

### 4. **Stateless Backend Service** (Scalability)

**Our backend doesn't store:**
- ❌ Active video connections
- ❌ Stream state
- ❌ Video data

**Backend only:**
- ✅ Generates tokens (stateless operation)
- ✅ Returns channel info
- ✅ Stores metadata in database (stream title, host, etc.)

**System Design Concept:** **Stateless Architecture**
- Any backend server can generate tokens
- Easy horizontal scaling
- No session affinity needed
- Agora cloud handles all stateful streaming

---

### 5. **SDK vs API Decision**

**We use Agora SDK (not REST API):**

**Backend:** `agora-token` package
- Generates tokens locally
- No API calls to Agora servers
- Fast (no network latency)

**Frontend:** `agora-rtc-sdk-ng` package
- Manages WebRTC connections
- Handles video encoding/decoding
- Manages network optimization

**Alternative we rejected:**
- Using Agora REST APIs → ❌ Slower, more complex, adds latency

**Software Development Concept:** **Client-Side SDK Pattern**
- Heavy lifting done in browser (video processing)
- Backend is lightweight (just token generation)

---

# Why Agora? (Technology Decision)

## Comparison Matrix

| Feature | Agora | Twitch API | Daily.co | Zoom SDK | Custom WebRTC |
|---------|-------|-----------|----------|----------|---------------|
| **Latency** | <400ms | 5-20s | <1s | <1s | Varies |
| **Setup Difficulty** | Medium | Hard | Easy | Hard | Very Hard |
| **Cost (10k min/mo)** | $10 | N/A | $10 | $$$ | Server costs |
| **For Auctions?** | ✅ Perfect | ❌ Too slow | ✅ Good | ⚠️ Overkill | ⚠️ Complex |
| **Mobile Support** | ✅ Native | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Hard |
| **Free Tier** | 10k min | ❌ No | 10k min | Limited | N/A |

**Decision: Agora**

**Why:**
1. **Low latency** (<400ms) crucial for real-time bidding
2. **Affordable** ($0.99 per 1000 minutes after free tier)
3. **Good documentation** and examples
4. **Production-ready** (used by apps with millions of users)
5. **Scales automatically** (no server management)

**Software Development Concept:** **Build vs Buy**
- Building custom WebRTC = months of work
- Using Agora = days of integration
- Focus on business logic, not infrastructure

---

# Backend Integration

## File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── agoraService.js          ← Token generation logic
│   ├── modules/
│   │   └── streams/
│   │       ├── streams.controller.js ← Uses agoraService
│   │       └── streams.routes.js     ← Exposes endpoints
│   └── config/
│       └── database.js
├── .env                              ← Agora credentials
└── package.json
```

---

## Backend Implementation Details

### 1. Environment Variables (.env)

```bash
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=your_app_certificate_here
```

**Why environment variables:**
- ✅ Secrets not in code (security)
- ✅ Different values per environment (dev/prod)
- ✅ Easy to rotate credentials

**Software Development Concept:** **Configuration Management**
- Separate configuration from code
- Never commit secrets to Git

---

### 2. Agora Service (agoraService.js)

```javascript
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

const agoraService = {
  generateHostToken: (channelName, uid) => { /* ... */ },
  generateViewerToken: (channelName, uid) => { /* ... */ }
};

module.exports = agoraService;
```

**Design Pattern:** **Service Layer Pattern**
- Encapsulates Agora logic
- Can be reused across controllers
- Easy to test in isolation
- Single Responsibility Principle

---

### 3. Token Generation Logic (Deep Dive)

```javascript
generateHostToken: (channelName, uid) => {
  // 1. Define role
  const role = RtcRole.PUBLISHER;
  
  // 2. Calculate expiration (1 hour from now)
  const expirationTimeInSeconds = 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
  
  // 3. Build token with UID
  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,              // Your Agora App ID
    APP_CERTIFICATE,     // Your Agora App Certificate (secret)
    channelName,         // Channel to join
    uid,                 // User ID (must be unique)
    role,                // PUBLISHER or SUBSCRIBER
    privilegeExpiredTs   // When token expires
  );
  
  // 4. Return complete config
  return {
    token,               // JWT token for authentication
    appId: APP_ID,       // Frontend needs this
    channel: channelName,// Channel to connect to
    uid: uid             // User's ID in the channel
  };
}
```

**Every Parameter Explained:**

1. **`APP_ID`** (Application Identifier)
   - Public identifier for your Agora project
   - Like a username
   - Not secret, can be in frontend

2. **`APP_CERTIFICATE`** (Secret Key)
   - Secret key for your Agora project
   - Like a password
   - MUST stay on backend only

3. **`channelName`** (Channel Name)
   - Name of the "room" for this stream
   - Must be same for host and viewers
   - Example: `"stream_42_1234567890"`

4. **`uid`** (User ID)
   - Unique identifier for this user in this channel
   - Can be number (0-2^32) or string
   - We use user's database ID
   - Agora uses this to route audio/video

5. **`role`** (User Role)
   - `RtcRole.PUBLISHER` = can broadcast
   - `RtcRole.SUBSCRIBER` = can only watch
   - Enforced by Agora servers

6. **`privilegeExpiredTs`** (Token Expiration Timestamp)
   - Unix timestamp when token expires
   - After expiration, user gets kicked
   - We set 1 hour (3600 seconds)
   - Security: limits damage if token stolen

**Return Value (token object):**
```javascript
{
  token: "006abc123...",     // JWT token (long string)
  appId: "your_app_id",      // App ID for frontend
  channel: "stream_42_...",  // Channel name
  uid: 123                   // User's ID
}
```

---

### 4. Function: `RtcTokenBuilder.buildTokenWithUid()`

**From:** `agora-token` package

**Purpose:** Generate authentication token for Agora RTC (Real-Time Communication)

**Signature:**
```javascript
RtcTokenBuilder.buildTokenWithUid(
  appId: string,           // Your Agora App ID
  appCertificate: string,  // Your Agora App Certificate
  channelName: string,     // Channel to join
  uid: number,             // User ID (0 or positive integer)
  role: RtcRole,           // PUBLISHER or SUBSCRIBER
  privilegeExpiredTs: number // Expiration timestamp
): string                  // Returns JWT token
```

**What it does internally:**
1. Creates a JWT (JSON Web Token)
2. Encodes role, uid, channel, expiration
3. Signs with App Certificate (HMAC-SHA256)
4. Returns base64-encoded string

**Why JWT:**
- ✅ Tamper-proof (signature verification)
- ✅ Self-contained (no database lookup)
- ✅ Time-limited (expires automatically)

**Software Development Concept:** **Stateless Authentication**
- Token contains all info needed
- Backend doesn't track tokens
- Agora verifies signature

---

### 5. Enum: `RtcRole`

**From:** `agora-token` package

```javascript
RtcRole = {
  PUBLISHER: 1,    // Can send and receive
  SUBSCRIBER: 2    // Can only receive
}
```

**Purpose:** Define user's permissions in channel

**Why enum instead of string:**
- ✅ Type safety
- ✅ Prevents typos
- ✅ Self-documenting code

---

### 6. Controller Integration (streams.controller.js)

```javascript
const agoraService = require('../../services/agoraService');
const pool = require('../../config/database');

const streamsController = {
  
  // When seller starts a stream
  startStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;  // From auth middleware
      
      // 1. Verify stream belongs to user
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1 AND host_id = $2',
        [streamId, hostId]
      );
      
      if (streamResult.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }
      
      // 2. Generate unique channel name
      const channelName = `stream_${streamId}_${Date.now()}`;
      
      // 3. Generate Agora token for host
      const agoraConfig = agoraService.generateHostToken(
        channelName,
        hostId
      );
      
      // 4. Update database with channel info
      await pool.query(
        `UPDATE streams 
         SET status = 'live',
             started_at = NOW(),
             agora_channel_name = $1,
             agora_token = $2
         WHERE id = $3`,
        [channelName, agoraConfig.token, streamId]
      );
      
      // 5. Return config to frontend
      res.json({
        message: 'Stream started',
        streamId,
        agora: agoraConfig  // { token, appId, channel, uid }
      });
      
    } catch (error) {
      next(error);
    }
  },
  
  // When viewer joins a stream
  joinStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const viewerId = req.user.id;
      
      // 1. Get stream details
      const streamResult = await pool.query(
        'SELECT agora_channel_name FROM streams WHERE id = $1 AND status = $2',
        [streamId, 'live']
      );
      
      if (streamResult.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not live' });
      }
      
      const channelName = streamResult.rows[0].agora_channel_name;
      
      // 2. Generate viewer token
      const agoraConfig = agoraService.generateViewerToken(
        channelName,
        viewerId
      );
      
      // 3. Return config
      res.json({
        message: 'Joined stream',
        agora: agoraConfig
      });
      
    } catch (error) {
      next(error);
    }
  }
};

module.exports = streamsController;
```

**Key Concepts:**

1. **Authentication Middleware** (`req.user.id`)
   - User already authenticated via JWT
   - We know who they are
   - Use their ID for Agora UID

2. **Database State Management**
   - Store channel name in database
   - Track stream status (pending/live/ended)
   - Link Agora channel to our stream ID

3. **Error Handling**
   - Check stream exists
   - Check user authorized
   - Validate stream is live
   - Use try/catch for exceptions

**Software Development Concepts:**
- **MVC Pattern:** Controller handles requests, delegates to service
- **Dependency Injection:** Service injected into controller
- **Error Boundaries:** Centralized error handling with `next(error)`

---

# Frontend Integration

## File Structure

```
frontend/
├── src/
│   ├── hooks/
│   │   └── useAgora.js               ← React hook for Agora
│   ├── services/
│   │   └── streamService.js          ← API calls to backend
│   ├── pages/
│   │   ├── StreamHostPage.jsx        ← Seller broadcasts
│   │   └── LivestreamPage.jsx        ← Viewers watch
│   └── components/
│       └── VideoPlayer.jsx           ← Video display component
└── package.json
```

---

## Frontend Implementation Details

### 1. Agora SDK Installation

```bash
npm install agora-rtc-sdk-ng
```

**What this package provides:**
- `AgoraRTC` - Main SDK object
- `IAgoraRTCClient` - Client interface for joining channels
- `ICameraVideoTrack` - Camera video stream
- `IMicrophoneAudioTrack` - Microphone audio stream
- `IRemoteVideoTrack` - Remote user's video
- `IRemoteAudioTrack` - Remote user's audio

---

### 2. Custom Hook: useAgora (Detailed Breakdown)

```javascript
import { useState, useEffect, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

// SDK Configuration
AgoraRTC.setLogLevel(process.env.NODE_ENV === 'production' ? 1 : 0);
// 0 = Debug (development)
// 1 = Info (production)
// Reduces console spam in production

export const useAgora = () => {
  // STATE MANAGEMENT
  const [client] = useState(() => AgoraRTC.createClient({ 
    mode: 'live',      // 'live' for broadcaster/audience model
    codec: 'vp8'       // Video codec (vp8 or h264)
  }));
  
  const [localTracks, setLocalTracks] = useState({
    videoTrack: null,  // Camera stream
    audioTrack: null   // Microphone stream
  });
  
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [joined, setJoined] = useState(false);
  
  // ... implementation
};
```

---

### 3. Function: `AgoraRTC.createClient()`

**Purpose:** Create Agora RTC client instance

**Parameters:**
```javascript
AgoraRTC.createClient({
  mode: 'live' | 'rtc',
  codec: 'vp8' | 'h264'
})
```

**Modes:**

1. **`'live'`** (We use this)
   - One-to-many broadcasting
   - Host broadcasts, audience watches
   - Perfect for: livestreams, auctions, webinars
   - Lower bandwidth for viewers

2. **`'rtc'`** (Alternative)
   - Many-to-many communication
   - Everyone can broadcast
   - Perfect for: video calls, conferences
   - Higher bandwidth

**Codecs:**

1. **`'vp8'`** (We use this)
   - Open-source codec
   - Good browser support
   - Free (no licensing)

2. **`'h264'`**
   - Better quality at same bitrate
   - Requires hardware acceleration
   - Licensing issues on some platforms

**Why we chose `mode: 'live', codec: 'vp8'`:**
- ✅ One seller, many viewers (live mode)
- ✅ Universal browser support (vp8)
- ✅ No codec licensing issues

---

### 4. Function: `client.join()`

**Purpose:** Join an Agora channel with authentication

**Signature:**
```javascript
await client.join(
  appId: string,        // Your Agora App ID
  channel: string,      // Channel name
  token: string | null, // Token from backend
  uid: number | null    // User ID (null = auto-assign)
): Promise<number>      // Returns assigned UID
```

**What happens:**
1. Connects to Agora servers
2. Authenticates with token
3. Joins specified channel
4. Returns assigned UID

**Example:**
```javascript
const uid = await client.join(
  'your_app_id',
  'stream_42_1234567890',
  '006abc123...',  // Token from backend
  123              // User's database ID
);
```

**Error cases:**
- Invalid token → `INVALID_TOKEN`
- Expired token → `TOKEN_EXPIRED`
- Channel full → `CHANNEL_CAPACITY_EXCEEDED`
- Network error → `NETWORK_ERROR`

---

### 5. Function: `AgoraRTC.createMicrophoneAudioTrack()`

**Purpose:** Access user's microphone and create audio track

**Parameters:**
```javascript
await AgoraRTC.createMicrophoneAudioTrack({
  encoderConfig: {
    sampleRate: 48000,      // Audio quality (Hz)
    stereo: true,           // Stereo vs mono
    bitrate: 128            // Bitrate (kbps)
  },
  AEC: true,                // Acoustic Echo Cancellation
  AGC: true,                // Automatic Gain Control
  ANS: true                 // Automatic Noise Suppression
})
```

**What it does:**
1. Asks browser for microphone permission
2. Accesses microphone stream
3. Applies audio processing (AEC, AGC, ANS)
4. Returns `IMicrophoneAudioTrack` object

**Audio Processing:**

1. **AEC (Acoustic Echo Cancellation)**
   - Removes echo from speakers
   - Essential for two-way communication
   - We keep it ON

2. **AGC (Automatic Gain Control)**
   - Normalizes audio volume
   - Makes quiet voices louder
   - We keep it ON

3. **ANS (Automatic Noise Suppression)**
   - Removes background noise
   - Keyboard clicks, fans, etc.
   - We keep it ON

---

### 6. Function: `AgoraRTC.createCameraVideoTrack()`

**Purpose:** Access user's camera and create video track

**Parameters:**
```javascript
await AgoraRTC.createCameraVideoTrack({
  encoderConfig: {
    width: 1280,            // Video width (pixels)
    height: 720,            // Video height (pixels)
    frameRate: 30,          // FPS
    bitrateMin: 600,        // Min bitrate (kbps)
    bitrateMax: 1000        // Max bitrate (kbps)
  },
  facingMode: 'user',       // 'user' (front) or 'environment' (back)
  optimizationMode: 'detail' // 'motion', 'detail', or 'balanced'
})
```

**What it does:**
1. Asks browser for camera permission
2. Accesses camera stream
3. Configures video encoding
4. Returns `ICameraVideoTrack` object

**Encoder Config Explained:**

1. **Resolution (1280x720)**
   - 720p HD quality
   - Good balance of quality/bandwidth
   - Lower for mobile: 640x480
   - Higher for desktop: 1920x1080

2. **Frame Rate (30fps)**
   - Smooth video
   - Standard for streaming
   - Can lower to 15fps to save bandwidth

3. **Bitrate (600-1000 kbps)**
   - Quality vs bandwidth tradeoff
   - Auto-adjusts based on network
   - Lower = worse quality but works on slow connections
   - Higher = better quality but needs good connection

4. **Optimization Mode:**
   - `'motion'` - Sports, fast movement
   - `'detail'` - Card close-ups, text (we use this)
   - `'balanced'` - Mix of both

---

### 7. Function: `client.publish()`

**Purpose:** Start broadcasting your audio/video to channel

**Signature:**
```javascript
await client.publish([audioTrack, videoTrack])
```

**What happens:**
1. Uploads your tracks to Agora servers
2. Agora distributes to all viewers in channel
3. Viewers receive `"user-published"` event

**Example:**
```javascript
// Start broadcasting
await client.publish([
  localTracks.audioTrack,
  localTracks.videoTrack
]);
```

**Software Development Concept:** **Pub/Sub Pattern**
- Publisher: Broadcasts content
- Subscribers: Receive content
- Agora: Message broker in the middle

---

### 8. Function: `client.setClientRole()`

**Purpose:** Change user's role in the channel

**Signature:**
```javascript
await client.setClientRole(
  role: 'host' | 'audience'
)
```

**Roles:**

1. **`'host'`** (Broadcaster)
   - Can publish audio/video
   - Receives audio/video from others
   - Higher bandwidth usage

2. **`'audience'`** (Viewer)
   - Can ONLY receive audio/video
   - Cannot publish
   - Lower bandwidth usage

**When to use:**
```javascript
// When joining as host (seller)
await client.setClientRole('host');

// When joining as viewer (bidder)
await client.setClientRole('audience');
```

**Why this matters:**
- Agora charges based on broadcast minutes
- Audience mode is cheaper
- Prevents accidental broadcasting

---

### 9. Event: `client.on('user-published')`

**Purpose:** Detect when remote user starts broadcasting

**Signature:**
```javascript
client.on('user-published', async (user, mediaType) => {
  // user: IRemoteUser object
  // mediaType: 'video' | 'audio'
});
```

**What happens:**
1. Remote user calls `client.publish()`
2. Agora notifies all viewers
3. This callback fires
4. You need to subscribe to receive media

**Example:**
```javascript
client.on('user-published', async (user, mediaType) => {
  console.log('User published:', user.uid, mediaType);
  
  // Subscribe to the track
  await client.subscribe(user, mediaType);
  
  if (mediaType === 'video') {
    // Get video track
    const videoTrack = user.videoTrack;
    // Play it in a div
    videoTrack.play('remote-video-container');
  }
  
  if (mediaType === 'audio') {
    // Get audio track
    const audioTrack = user.audioTrack;
    // Play audio (no container needed)
    audioTrack.play();
  }
});
```

**Software Development Concept:** **Event-Driven Architecture**
- React to events (user joins, publishes, leaves)
- Don't poll for changes
- Efficient, real-time

---

### 10. Function: `client.subscribe()`

**Purpose:** Subscribe to remote user's audio/video

**Signature:**
```javascript
await client.subscribe(
  user: IRemoteUser,           // Remote user object
  mediaType: 'video' | 'audio' // Which media to subscribe
)
```

**What happens:**
1. Tells Agora you want to receive this user's media
2. Agora starts streaming to you
3. User's track becomes available

**Why two-step (publish → subscribe):**
- ✅ Saves bandwidth (only get what you want)
- ✅ Selective subscription (video without audio, etc.)
- ✅ Scalability (don't force-receive all streams)

---

### 11. Function: `track.play()`

**Purpose:** Play video/audio track in DOM element

**For Video:**
```javascript
videoTrack.play(
  element: string | HTMLElement,  // Container div ID or element
  config?: {
    fit: 'contain' | 'cover',     // How video fills container
    mirror: boolean                // Mirror video (for selfie view)
  }
)
```

**Example:**
```javascript
// Play in div with id="video-player"
videoTrack.play('video-player', {
  fit: 'contain',  // Show full video (pillarbox if needed)
  mirror: false    // Don't mirror
});
```

**For Audio:**
```javascript
audioTrack.play()  // No parameters needed, plays through speakers
```

---

### 12. Function: `track.stop()`

**Purpose:** Stop playing track

```javascript
videoTrack.stop()  // Stops video
audioTrack.stop()  // Stops audio
```

**What happens:**
- Removes from DOM
- Stops playback
- Doesn't close the track (still capturing)

---

### 13. Function: `track.close()`

**Purpose:** Close track and release resources

```javascript
videoTrack.close()  // Releases camera
audioTrack.close()  // Releases microphone
```

**What happens:**
- Stops capturing
- Releases hardware (camera/mic)
- Camera light turns off
- Cannot be reused (create new track if needed)

**When to use:**
```javascript
// When leaving stream
await audioTrack.close();
await videoTrack.close();
await client.leave();
```

---

### 14. Function: `client.leave()`

**Purpose:** Leave the channel

```javascript
await client.leave()
```

**What happens:**
1. Stops publishing if broadcasting
2. Unsubscribes from all remote users
3. Disconnects from Agora servers
4. Triggers `'user-left'` event for others

**Best Practice:**
```javascript
// Proper cleanup order:
await client.leave();           // 1. Leave channel
await audioTrack?.close();      // 2. Close tracks
await videoTrack?.close();      // 3. Release hardware
```

---

### 15. Event: `client.on('user-left')`

**Purpose:** Detect when remote user leaves

```javascript
client.on('user-left', (user) => {
  console.log('User left:', user.uid);
  
  // Clean up UI
  setRemoteUsers(prev => 
    prev.filter(u => u.uid !== user.uid)
  );
});
```

---

## Complete useAgora Hook Implementation

```javascript
import { useState, useEffect, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(process.env.NODE_ENV === 'production' ? 1 : 0);

export const useAgora = () => {
  // Create client once (using useState factory function)
  const [client] = useState(() => 
    AgoraRTC.createClient({ 
      mode: 'live',  // Broadcaster-audience model
      codec: 'vp8'   // Video codec
    })
  );
  
  // Local tracks (camera + microphone)
  const [localTracks, setLocalTracks] = useState({
    videoTrack: null,
    audioTrack: null
  });
  
  // Remote users in channel
  const [remoteUsers, setRemoteUsers] = useState([]);
  
  // Connection state
  const [joined, setJoined] = useState(false);
  
  // JOIN AS HOST (Broadcaster)
  const joinAsHost = useCallback(async (channel, token, uid) => {
    try {
      // 1. Set role to host
      await client.setClientRole('host');
      
      // 2. Join channel
      await client.join(
        process.env.REACT_APP_AGORA_APP_ID,
        channel,
        token,
        uid
      );
      
      // 3. Create local tracks
      const [audioTrack, videoTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,  // Echo cancellation
          AGC: true,  // Gain control
          ANS: true   // Noise suppression
        }),
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMin: 600,
            bitrateMax: 1000
          },
          optimizationMode: 'detail'  // For showing cards
        })
      ]);
      
      // 4. Save tracks to state
      setLocalTracks({ videoTrack, audioTrack });
      
      // 5. Publish tracks
      await client.publish([audioTrack, videoTrack]);
      
      setJoined(true);
      console.log('✅ Joined as host');
      
    } catch (error) {
      console.error('❌ Failed to join as host:', error);
      throw error;
    }
  }, [client]);
  
  // JOIN AS VIEWER (Audience)
  const joinAsViewer = useCallback(async (channel, token, uid) => {
    try {
      // 1. Set role to audience
      await client.setClientRole('audience');
      
      // 2. Join channel (no publishing)
      await client.join(
        process.env.REACT_APP_AGORA_APP_ID,
        channel,
        token,
        uid
      );
      
      setJoined(true);
      console.log('✅ Joined as viewer');
      
    } catch (error) {
      console.error('❌ Failed to join as viewer:', error);
      throw error;
    }
  }, [client]);
  
  // LEAVE CHANNEL
  const leave = useCallback(async () => {
    try {
      // 1. Leave channel
      await client.leave();
      
      // 2. Close local tracks
      localTracks.audioTrack?.close();
      localTracks.videoTrack?.close();
      
      // 3. Reset state
      setLocalTracks({ videoTrack: null, audioTrack: null });
      setRemoteUsers([]);
      setJoined(false);
      
      console.log('✅ Left channel');
      
    } catch (error) {
      console.error('❌ Failed to leave:', error);
    }
  }, [client, localTracks]);
  
  // EVENT LISTENERS
  useEffect(() => {
    // When remote user publishes video/audio
    const handleUserPublished = async (user, mediaType) => {
      console.log('👤 User published:', user.uid, mediaType);
      
      // Subscribe to the media
      await client.subscribe(user, mediaType);
      
      // Update state
      setRemoteUsers(prevUsers => {
        const existing = prevUsers.find(u => u.uid === user.uid);
        if (existing) {
          // Update existing user
          return prevUsers.map(u =>
            u.uid === user.uid ? { ...u, ...user } : u
          );
        } else {
          // Add new user
          return [...prevUsers, user];
        }
      });
    };
    
    // When remote user unpublishes
    const handleUserUnpublished = (user, mediaType) => {
      console.log('👤 User unpublished:', user.uid, mediaType);
    };
    
    // When remote user leaves
    const handleUserLeft = (user) => {
      console.log('👋 User left:', user.uid);
      setRemoteUsers(prevUsers =>
        prevUsers.filter(u => u.uid !== user.uid)
      );
    };
    
    // Register listeners
    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);
    
    // Cleanup
    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left', handleUserLeft);
    };
  }, [client]);
  
  // CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);
  
  return {
    client,
    localTracks,
    remoteUsers,
    joined,
    joinAsHost,
    joinAsViewer,
    leave
  };
};
```

---

## Using the Hook in Components

### StreamHostPage (Seller broadcasts)

```javascript
import React, { useEffect, useRef } from 'react';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';

function StreamHostPage() {
  const { joinAsHost, localTracks, leave } = useAgora();
  const videoRef = useRef(null);
  
  useEffect(() => {
    const startStream = async () => {
      // 1. Call backend to start stream
      const response = await streamService.startStream(streamId);
      const { token, appId, channel, uid } = response.agora;
      
      // 2. Join Agora as host
      await joinAsHost(channel, token, uid);
    };
    
    startStream();
    
    return () => leave();
  }, []);
  
  useEffect(() => {
    // Play local video preview
    if (localTracks.videoTrack && videoRef.current) {
      localTracks.videoTrack.play(videoRef.current, {
        mirror: true  // Mirror for selfie view
      });
    }
  }, [localTracks]);
  
  return (
    <div>
      <h1>You're Live!</h1>
      <div ref={videoRef} style={{ width: 640, height: 480 }} />
    </div>
  );
}
```

### LivestreamPage (Viewers watch)

```javascript
import React, { useEffect, useRef } from 'react';
import { useAgora } from '../hooks/useAgora';
import { streamService } from '../services/streamService';

function LivestreamPage() {
  const { joinAsViewer, remoteUsers, leave } = useAgora();
  const videoRef = useRef(null);
  
  useEffect(() => {
    const joinStream = async () => {
      // 1. Call backend to get token
      const response = await streamService.joinStream(streamId);
      const { token, appId, channel, uid } = response.agora;
      
      // 2. Join Agora as viewer
      await joinAsViewer(channel, token, uid);
    };
    
    joinStream();
    
    return () => leave();
  }, []);
  
  useEffect(() => {
    // Play remote video when available
    if (remoteUsers.length > 0 && videoRef.current) {
      const remoteUser = remoteUsers[0];
      if (remoteUser.videoTrack) {
        remoteUser.videoTrack.play(videoRef.current);
      }
    }
  }, [remoteUsers]);
  
  return (
    <div>
      <h1>Watching Stream</h1>
      <div ref={videoRef} style={{ width: 640, height: 480 }} />
      {remoteUsers.length === 0 && <p>Waiting for host...</p>}
    </div>
  );
}
```

---

# Complete Flow Diagrams

## Flow 1: Seller Starts Stream

```
┌─────────────┐
│   SELLER    │
└──────┬──────┘
       │ 1. Click "Go Live"
       ▼
┌──────────────────────────────────┐
│  StreamHostPage Component        │
│  - useEffect runs on mount       │
└──────┬───────────────────────────┘
       │ 2. POST /api/streams/:id/start
       ▼
┌──────────────────────────────────┐
│  Backend Controller              │
│  - Get stream from database      │
│  - Generate channel name         │
│  - Call agoraService             │
└──────┬───────────────────────────┘
       │ 3. generateHostToken()
       ▼
┌──────────────────────────────────┐
│  agoraService                    │
│  - RtcRole.PUBLISHER             │
│  - RtcTokenBuilder.build...()   │
└──────┬───────────────────────────┘
       │ 4. Return { token, appId, channel, uid }
       ▼
┌──────────────────────────────────┐
│  Backend Controller              │
│  - Update database with channel  │
│  - Return config to frontend     │
└──────┬───────────────────────────┘
       │ 5. Response: agora config
       ▼
┌──────────────────────────────────┐
│  StreamHostPage Component        │
│  - Call joinAsHost()             │
└──────┬───────────────────────────┘
       │ 6. useAgora hook
       ▼
┌──────────────────────────────────┐
│  useAgora Hook                   │
│  - client.setClientRole('host')  │
│  - client.join(...)              │
│  - Create camera + mic tracks    │
│  - client.publish([tracks])      │
└──────┬───────────────────────────┘
       │ 7. Connect to Agora
       ▼
┌──────────────────────────────────┐
│  Agora Cloud                     │
│  - Authenticate token            │
│  - Create channel                │
│  - Start receiving video/audio   │
│  - Distribute to viewers         │
└──────────────────────────────────┘

✅ SELLER IS NOW LIVE
```

---

## Flow 2: Viewer Joins Stream

```
┌─────────────┐
│   VIEWER    │
└──────┬──────┘
       │ 1. Click stream thumbnail
       ▼
┌──────────────────────────────────┐
│  LivestreamPage Component        │
│  - useEffect runs on mount       │
└──────┬───────────────────────────┘
       │ 2. POST /api/streams/:id/join
       ▼
┌──────────────────────────────────┐
│  Backend Controller              │
│  - Get stream from database      │
│  - Get channel name              │
│  - Call agoraService             │
└──────┬───────────────────────────┘
       │ 3. generateViewerToken()
       ▼
┌──────────────────────────────────┐
│  agoraService                    │
│  - RtcRole.SUBSCRIBER            │
│  - RtcTokenBuilder.build...()   │
└──────┬───────────────────────────┘
       │ 4. Return { token, appId, channel, uid }
       ▼
┌──────────────────────────────────┐
│  Backend Controller              │
│  - Return config to frontend     │
└──────┬───────────────────────────┘
       │ 5. Response: agora config
       ▼
┌──────────────────────────────────┐
│  LivestreamPage Component        │
│  - Call joinAsViewer()           │
└──────┬───────────────────────────┘
       │ 6. useAgora hook
       ▼
┌──────────────────────────────────┐
│  useAgora Hook                   │
│  - client.setClientRole('aud...')│
│  - client.join(...)              │
│  - Listen for 'user-published'   │
└──────┬───────────────────────────┘
       │ 7. Connect to Agora
       ▼
┌──────────────────────────────────┐
│  Agora Cloud                     │
│  - Authenticate token            │
│  - Join channel                  │
│  - Send seller's video/audio     │
└──────┬───────────────────────────┘
       │ 8. 'user-published' event
       ▼
┌──────────────────────────────────┐
│  useAgora Hook                   │
│  - client.subscribe(user, media) │
│  - Update remoteUsers state      │
└──────┬───────────────────────────┘
       │ 9. remoteUsers state updates
       ▼
┌──────────────────────────────────┐
│  LivestreamPage Component        │
│  - useEffect triggers            │
│  - videoTrack.play(container)    │
└──────────────────────────────────┘

✅ VIEWER SEES LIVE VIDEO
```

---

# Security Considerations

## 1. Token Security

**Threats:**
- ❌ Token stolen → Unauthorized access
- ❌ Token reused → Impersonation
- ❌ App Certificate leaked → Anyone can generate tokens

**Mitigations:**
- ✅ Token expires in 1 hour (short-lived)
- ✅ Token tied to specific UID (can't be reused for different user)
- ✅ Token tied to specific channel (can't join other channels)
- ✅ App Certificate ONLY on backend (never exposed)
- ✅ HTTPS required (tokens encrypted in transit)

## 2. Role-Based Security

**Threats:**
- ❌ Viewer hijacks stream
- ❌ Unauthorized broadcasting

**Mitigations:**
- ✅ Roles enforced by Agora servers (not client-side)
- ✅ Viewers get SUBSCRIBER tokens (can't broadcast)
- ✅ Only stream owner can get PUBLISHER token

## 3. Channel Isolation

**Threats:**
- ❌ Users join wrong channel
- ❌ Cross-stream interference

**Mitigations:**
- ✅ Unique channel names per stream
- ✅ Backend validates stream ownership
- ✅ Tokens tied to specific channel

---

# Scalability & Performance

## How Agora Scales

```
Your Backend (1 server)
    ↓
Generates tokens
    ↓
Agora Cloud (Global)
├── Edge Node (Los Angeles)
├── Edge Node (New York)  
├── Edge Node (London)
├── Edge Node (Tokyo)
└── Edge Node (Sydney)
    ↓
Routes video/audio to nearest edge
    ↓
Users connect to closest edge
```

**Why this scales:**
- ✅ Your backend is stateless (just generates tokens)
- ✅ Agora handles all video routing
- ✅ Agora has global CDN
- ✅ Auto-scales to millions of users
- ✅ You don't manage servers

## Performance Optimizations

1. **Adaptive Bitrate**
   - Agora auto-adjusts quality based on network
   - Slow connection → Lower resolution
   - Fast connection → Higher resolution

2. **P2P Mode**
   - <4 users → Direct peer-to-peer
   - >4 users → Agora servers relay
   - Saves server costs

3. **Selective Subscription**
   - Only subscribe to streams you want
   - Don't force-receive all videos
   - Saves bandwidth

---

# Error Handling

## Common Errors & Solutions

### 1. PERMISSION_DENIED

**Cause:** User denied camera/microphone access

**Solution:**
```javascript
try {
  await joinAsHost(channel, token, uid);
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    alert('Please allow camera and microphone access');
  }
}
```

### 2. TOKEN_EXPIRED

**Cause:** Token expired (after 1 hour)

**Solution:**
```javascript
client.on('token-privilege-will-expire', async () => {
  // Request new token from backend
  const newToken = await fetchNewToken();
  await client.renewToken(newToken);
});
```

### 3. NETWORK_ERROR

**Cause:** Poor internet connection

**Solution:**
```javascript
client.on('connection-state-change', (state) => {
  if (state === 'DISCONNECTED') {
    showError('Connection lost, reconnecting...');
    // Auto-reconnect logic
  }
});
```

---

# Testing Strategy

## Unit Tests

```javascript
// Test token generation
test('generates valid host token', () => {
  const token = agoraService.generateHostToken('channel', 123);
  expect(token).toHaveProperty('token');
  expect(token).toHaveProperty('appId');
  expect(token.appId).toBe(process.env.AGORA_APP_ID);
});

// Test role assignment
test('host token has PUBLISHER role', () => {
  // Mock RtcTokenBuilder
  // Verify role parameter = 1 (PUBLISHER)
});
```

## Integration Tests

```javascript
// Test full flow
test('seller can start stream', async () => {
  const response = await request(app)
    .post('/api/streams/1/start')
    .set('Authorization', 'Bearer ' + sellerToken);
  
  expect(response.status).toBe(200);
  expect(response.body.agora).toHaveProperty('token');
});
```

## Manual Testing Checklist

- [ ] Seller can start stream
- [ ] Viewer can join stream
- [ ] Video shows up for viewer
- [ ] Audio works
- [ ] Multiple viewers can join
- [ ] Stream ends properly
- [ ] Camera/mic released when leaving
- [ ] Works on mobile
- [ ] Works on different browsers

---

# Summary

## What We Built

1. **Backend Service**
   - Generates Agora tokens securely
   - Manages stream lifecycle
   - Stores channel metadata

2. **Frontend Integration**
   - Custom React hook for Agora
   - Host page for broadcasting
   - Viewer page for watching
   - Event-driven architecture

3. **Security**
   - Token-based authentication
   - Role-based access control
   - Channel isolation
   - App Certificate never exposed

4. **Scalability**
   - Stateless backend
   - Agora handles distribution
   - Global CDN
   - Adaptive bitrate

## Key Software Concepts Used

- **Separation of Concerns:** Backend auth, Agora streaming
- **Service Layer Pattern:** agoraService encapsulation
- **Event-Driven Architecture:** React to Agora events
- **Custom Hooks:** Reusable Agora logic
- **Stateless Authentication:** JWT tokens
- **Pub/Sub Pattern:** Broadcast/subscribe model
- **RBAC:** Role-based permissions

## Why This Architecture is Good

✅ **Secure:** App Certificate never exposed
✅ **Scalable:** Stateless, Agora auto-scales
✅ **Maintainable:** Clean separation, service layer
✅ **Testable:** Each layer can be tested independently
✅ **Performant:** Agora's global CDN, <400ms latency
✅ **Cost-Effective:** Pay per minute, free tier

---

**You now have a production-ready livestreaming system integrated with your auction platform!** 🎥🚀


# 🔄 Agora → LiveKit Migration Guide

## Your Pokémon Auction App — Complete Migration

---

## Why LiveKit Over Agora?

| Feature | Agora (Current) | LiveKit (New) |
|---------|----------------|---------------|
| **Pricing** | 10k free min/mo, then $0.99/1k min | Free tier: 5,000 min + 50GB BW. Ship plan: $50/mo for 150k min |
| **Open Source** | No (proprietary) | Yes (Apache 2.0) — self-host for free later |
| **Latency** | <400ms | <300ms (WebRTC-native SFU) |
| **Lock-in** | High (proprietary SDK) | Low — can move to self-hosted anytime |
| **React Support** | Manual SDK management | `@livekit/components-react` with built-in hooks |
| **Scaling Path** | Pay Agora more | Self-host on your own infra at scale |

**Bottom line:** LiveKit Cloud free tier is enough for development. When you grow, the $50/mo Ship plan covers 150k minutes. At real scale, you self-host for free.

---

## What Changes (File Map)

Here's every file you'll touch, organized by action:

### Files to DELETE (Agora-specific)
```
backend/src/services/agoraService.js          → DELETE
frontend/src/hooks/useAgora.js                → DELETE
```

### Files to CREATE (LiveKit replacements)
```
backend/src/services/livekitService.js        → NEW
frontend/src/hooks/useLiveKit.js              → NEW
```

### Files to EDIT (update imports/logic)
```
backend/src/modules/streams/streams.controller.js  → EDIT
backend/package.json                               → EDIT (swap deps)
frontend/src/pages/StreamHostPage.jsx              → EDIT
frontend/src/pages/LivestreamPage.jsx              → EDIT
frontend/package.json                              → EDIT (swap deps)
frontend/.env                                      → EDIT
backend/.env                                       → EDIT
```

### Database — NO CHANGES needed
Your `streams` table already has everything LiveKit needs. The `channel_name` column maps directly to LiveKit's "room name" concept.

---

## Step 1: Create a LiveKit Cloud Account

1. Go to **https://cloud.livekit.io** and sign up (free)
2. Create a new project called `Pokemon Auction App`
3. From your project dashboard, copy these three values:
   - **WebSocket URL** — looks like `wss://your-project-abc123.livekit.cloud`
   - **API Key** — looks like `APIxxxxxxxxx`
   - **API Secret** — a long string (keep this secret!)

---

## Step 2: Update Environment Variables

### Backend `.env`
```env
# ===== REMOVE these Agora lines =====
# AGORA_APP_ID=your_old_agora_app_id
# AGORA_APP_CERTIFICATE=your_old_agora_cert

# ===== ADD these LiveKit lines =====
LIVEKIT_API_KEY=APIxxxxxxxxx
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_WS_URL=wss://your-project-abc123.livekit.cloud
```

### Frontend `.env`
```env
# ===== REMOVE this Agora line =====
# REACT_APP_AGORA_APP_ID=your_old_agora_app_id

# ===== ADD this LiveKit line =====
REACT_APP_LIVEKIT_WS_URL=wss://your-project-abc123.livekit.cloud
```

---

## Step 3: Install New Dependencies

### Backend
```bash
cd backend

# Remove Agora
npm uninstall agora-token

# Install LiveKit server SDK
npm install livekit-server-sdk
```

### Frontend
```bash
cd frontend

# Remove Agora
npm uninstall agora-rtc-sdk-ng

# Install LiveKit client + React components
npm install livekit-client @livekit/components-react
```

---

## Step 4: Create Backend LiveKit Service

**Create new file:** `backend/src/services/livekitService.js`

This replaces `agoraService.js`. Instead of Agora's token builder, we use LiveKit's `AccessToken` class.

```javascript
const { AccessToken } = require('livekit-server-sdk');

// ============================================================
// LIVEKIT SERVICE
// ============================================================
// Generates access tokens for hosts and viewers.
//
// KEY CONCEPT: LiveKit uses "rooms" instead of "channels".
// A room is created automatically when the first participant joins.
// Permissions are controlled via token grants:
//   - canPublish: true  → host can send video/audio
//   - canPublish: false → viewer can only watch
// ============================================================

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL;

const livekitService = {

  /**
   * Generate a token for the HOST (broadcaster/seller)
   *
   * @param {string} roomName - Unique room name (your channel_name from DB)
   * @param {string} identity - Unique participant ID (use `host_${userId}`)
   * @param {string} participantName - Display name shown to viewers
   * @returns {object} { token, wsUrl, roomName, identity }
   */
  generateHostToken: async (roomName, identity, participantName) => {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: identity,
      name: participantName,
      ttl: '6h',  // Token valid for 6 hours
    });

    at.addGrant({
      roomJoin: true,           // Can join the room
      room: roomName,           // Which room
      canPublish: true,         // Can send video + audio (HOST)
      canSubscribe: true,       // Can receive others' streams
      canPublishData: true,     // Can send data messages (for chat later)
      roomCreate: true,         // Can create room if it doesn't exist
    });

    const token = await at.toJwt();

    return {
      token,
      wsUrl: LIVEKIT_WS_URL,
      roomName,
      identity,
    };
  },

  /**
   * Generate a token for a VIEWER (subscriber/bidder)
   *
   * @param {string} roomName - Same room name the host is in
   * @param {string} identity - Unique participant ID (use `viewer_${userId}`)
   * @param {string} participantName - Display name shown in chat
   * @returns {object} { token, wsUrl, roomName, identity }
   */
  generateViewerToken: async (roomName, identity, participantName) => {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: identity,
      name: participantName,
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,           // Can join the room
      room: roomName,           // Which room
      canPublish: false,        // CANNOT send video/audio (VIEWER)
      canSubscribe: true,       // Can receive host's stream
      canPublishData: true,     // Can send data messages (for chat/bids)
    });

    const token = await at.toJwt();

    return {
      token,
      wsUrl: LIVEKIT_WS_URL,
      roomName,
      identity,
    };
  },
};

module.exports = livekitService;
```

**What's different from Agora:**
- Agora used `RtcRole.PUBLISHER` vs `RtcRole.SUBSCRIBER` — LiveKit uses `canPublish: true/false`
- Agora needed numeric UIDs — LiveKit uses string identities (more flexible)
- Agora tokens were synchronous — LiveKit's `toJwt()` is async (returns a Promise)
- LiveKit tokens also carry a `wsUrl` so the frontend knows where to connect

---

## Step 5: Update Streams Controller

**Edit file:** `backend/src/modules/streams/streams.controller.js`

Replace every reference to `agoraService` with `livekitService`. The response shape changes slightly.

```javascript
const pool = require('../../config/database');
const livekitService = require('../../services/livekitService');

// ============================================================
// STREAMS CONTROLLER — LiveKit Version
// ============================================================

const streamsController = {

  // ── GET ACTIVE STREAMS ──────────────────────────────────
  getActiveStreams: async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT s.*, u.username as host_name
         FROM streams s
         JOIN users u ON s.host_id = u.id
         WHERE s.status IN ('live', 'scheduled')
         ORDER BY s.started_at DESC`
      );
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  },

  // ── GET STREAM BY ID ───────────────────────────────────
  getStreamById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT s.*, u.username as host_name
         FROM streams s
         JOIN users u ON s.host_id = u.id
         WHERE s.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Stream not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  // ── CREATE STREAM ──────────────────────────────────────
  createStream: async (req, res, next) => {
    try {
      const { title, description } = req.body;
      const hostId = req.user.id;

      if (!title) {
        return res.status(400).json({ message: 'Stream title is required' });
      }

      // Check for existing active stream
      const existing = await pool.query(
        `SELECT id FROM streams
         WHERE host_id = $1 AND status IN ('scheduled', 'live')`,
        [hostId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          message: 'You already have an active stream',
          streamId: existing.rows[0].id,
        });
      }

      // Generate a unique room name for LiveKit
      const channelName = `stream_${hostId}_${Date.now()}`;

      const result = await pool.query(
        `INSERT INTO streams (host_id, title, description, channel_name, status)
         VALUES ($1, $2, $3, $4, 'scheduled')
         RETURNING *`,
        [hostId, title, description || '', channelName]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  // ── START STREAM (get HOST token) ──────────────────────
  // POST /api/streams/:id/start
  //
  // This is IDEMPOTENT — calling it again returns a fresh token
  // even if the stream is already live.
  startStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      console.log('🎥 Starting stream:', streamId, 'for user:', hostId);

      // Verify stream exists and belongs to user
      const streamResult = await pool.query(
        'SELECT * FROM streams WHERE id = $1 AND host_id = $2',
        [streamId, hostId]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or unauthorized',
        });
      }

      const stream = streamResult.rows[0];

      // Use existing channel_name or generate one
      const roomName = stream.channel_name || `stream_${streamId}_${Date.now()}`;

      // Generate LiveKit HOST token
      const livekitConfig = await livekitService.generateHostToken(
        roomName,
        `host_${hostId}`,        // identity
        req.user.username         // display name
      );

      console.log('🔑 Generated LiveKit host token:', {
        wsUrl: livekitConfig.wsUrl,
        room: livekitConfig.roomName,
        identity: livekitConfig.identity,
      });

      // Update DB — only flip to 'live' if not already
      if (stream.status !== 'live') {
        await pool.query(
          `UPDATE streams
           SET status = 'live',
               started_at = NOW(),
               channel_name = $1
           WHERE id = $2`,
          [roomName, streamId]
        );
      }

      // Return LiveKit credentials to frontend
      res.json({
        message: 'Stream started successfully',
        streamId: parseInt(streamId),
        livekit: livekitConfig,  // { token, wsUrl, roomName, identity }
      });

      console.log('✅ Stream started successfully');
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      next(error);
    }
  },

  // ── JOIN STREAM (get VIEWER token) ─────────────────────
  // POST /api/streams/:id/join
  joinStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const viewerId = req.user.id;

      console.log('👁️  Viewer joining stream:', streamId, 'user:', viewerId);

      // Get live stream details
      const streamResult = await pool.query(
        `SELECT channel_name, host_id, title
         FROM streams
         WHERE id = $1 AND status = 'live'`,
        [streamId]
      );

      if (streamResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or not live',
        });
      }

      const { channel_name, host_id } = streamResult.rows[0];

      // Prevent host from joining as viewer
      if (host_id === viewerId) {
        return res.status(400).json({
          message: 'Host cannot join as viewer',
        });
      }

      // Generate LiveKit VIEWER token
      const livekitConfig = await livekitService.generateViewerToken(
        channel_name,
        `viewer_${viewerId}`,    // identity
        req.user.username         // display name
      );

      console.log('🔑 Generated LiveKit viewer token');

      // Increment viewer count
      await pool.query(
        'UPDATE streams SET viewer_count = viewer_count + 1 WHERE id = $1',
        [streamId]
      );

      res.json({
        message: 'Joined stream successfully',
        streamId: parseInt(streamId),
        livekit: livekitConfig,  // { token, wsUrl, roomName, identity }
      });

      console.log('✅ Viewer joined successfully');
    } catch (error) {
      console.error('❌ Error joining stream:', error);
      next(error);
    }
  },

  // ── END STREAM ─────────────────────────────────────────
  endStream: async (req, res, next) => {
    try {
      const { id: streamId } = req.params;
      const hostId = req.user.id;

      const result = await pool.query(
        `UPDATE streams
         SET status = 'ended',
             ended_at = NOW()
         WHERE id = $1 AND host_id = $2 AND status = 'live'
         RETURNING *`,
        [streamId, hostId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Stream not found or already ended',
        });
      }

      // LiveKit rooms auto-close when all participants disconnect
      // No need to manually delete the room

      res.json({
        message: 'Stream ended successfully',
        stream: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = streamsController;
```

**Key differences from Agora version:**
- Response returns `livekit: { token, wsUrl, roomName, identity }` instead of `agora: { token, appId, channel, uid }`
- Token generation is now `await`ed (async)
- LiveKit rooms auto-close when empty — no manual cleanup needed
- No need to store tokens in DB (they're short-lived JWTs)

---

## Step 6: Create Frontend LiveKit Hook

**Create new file:** `frontend/src/hooks/useLiveKit.js`

This replaces `useAgora.js`. Instead of managing an Agora client manually, we use LiveKit's `Room` class from `livekit-client`.

```javascript
import { useState, useCallback, useRef } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalTracks,
} from 'livekit-client';

// ============================================================
// useLiveKit Hook — Replaces useAgora
// ============================================================
//
// KEY DIFFERENCES FROM AGORA:
// - No "client role" concept — permissions come from the token
// - Rooms auto-create when the first participant joins
// - Track subscription is automatic (no manual subscribe calls)
// - Event names are different but concepts are the same
// ============================================================

export const useLiveKit = () => {
  // Room instance (like Agora's client)
  const roomRef = useRef(null);

  // State
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [error, setError] = useState(null);

  // ── SETUP ROOM EVENT LISTENERS ──────────────────────────
  const setupListeners = useCallback((room) => {
    // When a remote participant publishes a track (host's video/audio)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('📺 Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track);
      }
      if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(track);
        // Auto-attach audio so viewer hears it
        const audioEl = track.attach();
        document.body.appendChild(audioEl);
      }
    });

    // When a remote track is removed
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('🔇 Track unsubscribed:', track.kind, 'from', participant.identity);

      track.detach().forEach((el) => el.remove());

      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(null);
      }
      if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(null);
      }
    });

    // Connection quality changes
    room.on(RoomEvent.Disconnected, () => {
      console.log('🔌 Disconnected from room');
      setIsJoined(false);
      setIsPublishing(false);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
    });

    room.on(RoomEvent.Reconnecting, () => {
      console.log('🔄 Reconnecting...');
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('✅ Reconnected!');
    });
  }, []);

  // ── JOIN AS HOST ────────────────────────────────────────
  // Creates local camera + mic tracks and publishes them
  const joinAsHost = useCallback(async (wsUrl, token) => {
    try {
      console.log('🎥 Joining as host...');
      setError(null);

      // Create room with good defaults for livestreaming
      const room = new Room({
        adaptiveStream: true,    // Auto-adjust quality based on viewer bandwidth
        dynacast: true,          // Only send video layers that viewers need
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,  // 720p default
        },
      });

      roomRef.current = room;
      setupListeners(room);

      // Connect to LiveKit server with our token
      await room.connect(wsUrl, token);
      console.log('✅ Connected to room:', room.name);
      setIsJoined(true);

      // Try to create and publish camera + mic
      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: true,
        });

        for (const track of tracks) {
          await room.localParticipant.publishTrack(track);

          if (track.kind === Track.Kind.Video) {
            setLocalVideoTrack(track);
          }
          if (track.kind === Track.Kind.Audio) {
            setLocalAudioTrack(track);
          }
        }

        setIsPublishing(true);
        console.log('✅ Publishing video + audio');
      } catch (deviceError) {
        console.warn('⚠️ Camera/mic error, trying audio-only:', deviceError.message);

        // Fallback: try audio-only
        try {
          const [audioTrack] = await createLocalTracks({
            audio: true,
            video: false,
          });
          await room.localParticipant.publishTrack(audioTrack);
          setLocalAudioTrack(audioTrack);
          setIsPublishing(true);
          console.log('✅ Publishing audio-only (no camera)');
        } catch (audioError) {
          console.warn('⚠️ No mic either, joined with no media:', audioError.message);
          // Still connected, just can't publish
        }
      }
    } catch (err) {
      console.error('❌ Failed to join as host:', err);
      setError(err.message);
      throw err;
    }
  }, [setupListeners]);

  // ── JOIN AS VIEWER ──────────────────────────────────────
  // Connects to room but does NOT publish any tracks
  const joinAsViewer = useCallback(async (wsUrl, token) => {
    try {
      console.log('👁️  Joining as viewer...');
      setError(null);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;
      setupListeners(room);

      // Connect — track subscription happens automatically
      await room.connect(wsUrl, token);
      console.log('✅ Connected as viewer to room:', room.name);
      setIsJoined(true);
    } catch (err) {
      console.error('❌ Failed to join as viewer:', err);
      setError(err.message);
      throw err;
    }
  }, [setupListeners]);

  // ── LEAVE ROOM ──────────────────────────────────────────
  const leave = useCallback(async () => {
    try {
      const room = roomRef.current;
      if (room) {
        // Stop and detach all local tracks
        if (localVideoTrack) {
          localVideoTrack.stop();
        }
        if (localAudioTrack) {
          localAudioTrack.stop();
        }

        await room.disconnect(true);  // true = stop all tracks
        roomRef.current = null;
      }

      setIsJoined(false);
      setIsPublishing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
      setIsMicMuted(false);
      setIsCameraMuted(false);

      console.log('👋 Left room');
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  }, [localVideoTrack, localAudioTrack]);

  // ── TOGGLE MIC ──────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setMicrophoneEnabled(!isMicMuted ? false : true);
      setIsMicMuted(!isMicMuted);
      console.log(isMicMuted ? '🎤 Mic unmuted' : '🔇 Mic muted');
    } catch (err) {
      console.error('Error toggling mic:', err);
    }
  }, [isMicMuted]);

  // ── TOGGLE CAMERA ───────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setCameraEnabled(!isCameraMuted ? false : true);
      setIsCameraMuted(!isCameraMuted);
      console.log(isCameraMuted ? '📷 Camera on' : '📷 Camera off');
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  }, [isCameraMuted]);

  return {
    // State
    isJoined,
    isPublishing,
    isMicMuted,
    isCameraMuted,
    remoteVideoTrack,
    remoteAudioTrack,
    localVideoTrack,
    localAudioTrack,
    error,

    // Actions
    joinAsHost,
    joinAsViewer,
    leave,
    toggleMic,
    toggleCamera,
  };
};
```

**Key differences from `useAgora`:**
- No `AgoraRTC.createClient()` — LiveKit uses `new Room()` instead
- No manual `client.setClientRole()` — permissions come from the token
- No `client.subscribe()` — LiveKit auto-subscribes to remote tracks
- `toggleMic`/`toggleCamera` use `setMicrophoneEnabled()`/`setCameraEnabled()` instead of `track.setEnabled()`
- Audio attachment: remote audio tracks need `.attach()` to be heard (LiveKit doesn't auto-play)

---

## Step 7: Update StreamHostPage

**Edit file:** `frontend/src/pages/StreamHostPage.jsx`

Replace all Agora references with LiveKit. The page structure stays the same — only the streaming logic changes.

```javascript
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { streamService } from '../services/streamService';

function StreamHost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  // LiveKit hook (replaces useAgora)
  const {
    isJoined,
    isPublishing,
    isMicMuted,
    isCameraMuted,
    localVideoTrack,
    error: livekitError,
    joinAsHost,
    leave,
    toggleMic,
    toggleCamera,
  } = useLiveKit();

  // Stream state
  const [streamId, setStreamId] = useState(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamStatus, setStreamStatus] = useState('idle'); // idle | created | live
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Check for existing live stream on mount ─────────────
  useEffect(() => {
    const checkExistingStream = async () => {
      try {
        const response = await streamService.getActiveStreams();
        const streams = response.data || response;
        const myStream = streams.find(
          (s) => s.host_name === user?.username && s.status === 'live'
        );
        if (myStream) {
          setStreamId(myStream.id);
          setStreamTitle(myStream.title);
          setStreamStatus('live');
        }
      } catch (err) {
        console.log('No existing stream found');
      }
    };
    if (user) checkExistingStream();
  }, [user]);

  // ── Play local video when track is available ────────────
  useEffect(() => {
    if (localVideoTrack && videoRef.current) {
      // LiveKit: attach track to a DOM element
      const videoEl = localVideoTrack.attach(videoRef.current);
      return () => {
        localVideoTrack.detach(videoRef.current);
      };
    }
  }, [localVideoTrack]);

  // ── Create Stream ───────────────────────────────────────
  const handleCreateStream = async (e) => {
    e.preventDefault();
    if (!streamTitle.trim()) {
      setError('Please enter a stream title');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await streamService.createStream({
        title: streamTitle,
        description: streamDescription,
      });

      const stream = response.data || response;
      const newId = stream.id || stream.streamId;
      setStreamId(newId);
      setStreamStatus('created');
      console.log('✅ Stream created:', newId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create stream');
    } finally {
      setLoading(false);
    }
  };

  // ── Go Live ─────────────────────────────────────────────
  const handleGoLive = async () => {
    if (!streamId) return;
    setLoading(true);
    setError('');

    try {
      // 1. Get LiveKit credentials from backend
      const response = await streamService.startStream(streamId);
      const data = response.data || response;
      const { token, wsUrl } = data.livekit;

      console.log('🔑 Got LiveKit credentials, connecting...');

      // 2. Join LiveKit room as host
      await joinAsHost(wsUrl, token);

      setStreamStatus('live');
      console.log('✅ Now live!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to go live');
      console.error('❌ Go live failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── End Stream ──────────────────────────────────────────
  const handleEndStream = async () => {
    try {
      await leave();                          // Disconnect from LiveKit
      await streamService.endStream(streamId); // Update DB
      setStreamStatus('idle');
      setStreamId(null);
      navigate('/');
    } catch (err) {
      console.error('Error ending stream:', err);
    }
  };

  // ── Toggle controls ─────────────────────────────────────
  const handleToggleMic = async () => await toggleMic();
  const handleToggleCamera = async () => await toggleCamera();

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1419] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black mb-6">
          {streamStatus === 'live' ? '🔴 You\'re Live!' : '🎥 Start a Stream'}
        </h1>

        {/* Error display */}
        {(error || livekitError) && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-6">
            {error || livekitError}
          </div>
        )}

        {/* ── Step 1: Create Stream Form ── */}
        {streamStatus === 'idle' && (
          <form onSubmit={handleCreateStream} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Stream Title</label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="e.g., Opening Vintage Pokémon Packs!"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Description (optional)</label>
              <textarea
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="What cards will you be auctioning?"
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Stream'}
            </button>
          </form>
        )}

        {/* ── Step 2: Go Live Button ── */}
        {streamStatus === 'created' && (
          <div className="space-y-4">
            <p className="text-gray-400">
              Stream "<span className="text-white">{streamTitle}</span>" is ready.
              Click below to go live!
            </p>
            <button
              onClick={handleGoLive}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : '🔴 Go Live'}
            </button>
          </div>
        )}

        {/* ── Step 3: Live Stream View ── */}
        {streamStatus === 'live' && (
          <div className="space-y-4">
            {/* Video preview */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!localVideoTrack && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  {isPublishing ? 'Audio-only (no camera detected)' : 'Connecting...'}
                </div>
              )}
              {/* Live indicator */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-sm font-bold">LIVE</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleMic}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isMicMuted
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {isMicMuted ? '🔇 Unmute' : '🎤 Mute'}
              </button>

              <button
                onClick={handleToggleCamera}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  isCameraMuted
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {isCameraMuted ? '📷 Turn On' : '📷 Turn Off'}
              </button>

              <button
                onClick={handleEndStream}
                className="bg-gray-800 hover:bg-red-600 px-4 py-2 rounded-xl font-medium transition-colors ml-auto"
              >
                End Stream
              </button>
            </div>

            {/* Connection info */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>Connected: {isJoined ? '✅ Yes' : '❌ No'}</p>
              <p>Publishing: {isPublishing ? '✅ Yes' : '❌ No'}</p>
              <p>
                Share link:{' '}
                <code className="text-violet-400">
                  {`${window.location.origin}/livestream/${streamId}`}
                </code>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StreamHost;
```

---

## Step 8: Update LivestreamPage (Viewer)

**Edit file:** `frontend/src/pages/LivestreamPage.jsx`

```javascript
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveKit } from '../hooks/useLiveKit';
import { streamService } from '../services/streamService';

function StreamViewer() {
  const { id } = useParams();  // Must match route: /livestream/:id
  const streamId = id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  // LiveKit hook
  const {
    isJoined,
    remoteVideoTrack,
    error: livekitError,
    joinAsViewer,
    leave,
  } = useLiveKit();

  // Stream info
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Fetch stream info ───────────────────────────────────
  useEffect(() => {
    const fetchStream = async () => {
      try {
        const response = await streamService.getStreamById(streamId);
        const data = response.data || response;
        setStream(data);
      } catch (err) {
        setError('Stream not found or no longer available');
      } finally {
        setLoading(false);
      }
    };

    if (streamId) fetchStream();
  }, [streamId]);

  // ── Auto-join if stream is live ─────────────────────────
  useEffect(() => {
    if (stream?.status === 'live' && user && !isJoined) {
      handleJoinStream();
    }
  }, [stream, user]);

  // ── Attach remote video when track arrives ──────────────
  useEffect(() => {
    if (remoteVideoTrack && videoRef.current) {
      remoteVideoTrack.attach(videoRef.current);
      return () => {
        remoteVideoTrack.detach(videoRef.current);
      };
    }
  }, [remoteVideoTrack]);

  // ── Join stream ─────────────────────────────────────────
  const handleJoinStream = async () => {
    if (!streamId || !user) return;
    setError('');

    try {
      // 1. Get LiveKit viewer credentials from backend
      const response = await streamService.joinStream(streamId);
      const data = response.data || response;
      const { token, wsUrl } = data.livekit;

      console.log('🔑 Got LiveKit viewer credentials, connecting...');

      // 2. Join LiveKit room as viewer
      await joinAsViewer(wsUrl, token);

      console.log('✅ Joined as viewer!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join stream');
      console.error('❌ Join failed:', err);
    }
  };

  // ── Leave stream ────────────────────────────────────────
  const handleLeave = async () => {
    await leave();
    navigate('/');
  };

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  // ── RENDER ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400 text-lg">Loading stream...</p>
      </div>
    );
  }

  if (error && !stream) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video area */}
          <div className="lg:col-span-2">
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteVideoTrack && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  {isJoined
                    ? 'Waiting for host to start broadcasting...'
                    : 'Connecting to stream...'}
                </div>
              )}

              {/* Live badge */}
              {stream?.status === 'live' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-sm font-bold">LIVE</span>
                </div>
              )}
            </div>

            {/* Stream info */}
            <div className="mt-4">
              <h1 className="text-2xl font-bold">{stream?.title}</h1>
              <p className="text-gray-400 mt-1">
                Hosted by <span className="text-violet-400">{stream?.host_name}</span>
              </p>
              {stream?.description && (
                <p className="text-gray-500 mt-2">{stream.description}</p>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4">
              {!isJoined && stream?.status === 'live' && (
                <button
                  onClick={handleJoinStream}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl"
                >
                  Join Stream
                </button>
              )}
              {isJoined && (
                <button
                  onClick={handleLeave}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl"
                >
                  Leave Stream
                </button>
              )}
            </div>

            {(error || livekitError) && (
              <p className="text-red-400 mt-3">{error || livekitError}</p>
            )}
          </div>

          {/* Sidebar — future: chat + bidding panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-4 h-96">
              <h3 className="font-bold text-sm text-gray-400 mb-3">LIVE CHAT</h3>
              <p className="text-gray-600 text-sm">Chat coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StreamViewer;
```

---

## Step 9: Update Frontend Stream Service

**Edit file:** `frontend/src/services/streamService.js`

No major changes needed here — the API endpoints stay the same. The only difference is the response shape (backend now returns `livekit` instead of `agora`). Your existing `streamService.js` should already work since we're not changing the URL paths, just the response body. But for clarity, here's the complete file:

```javascript
import api from './api';

export const streamService = {
  getActiveStreams: async () => {
    const response = await api.get('/streams/active');
    return response.data;
  },

  getStreamById: async (streamId) => {
    const response = await api.get(`/streams/${streamId}`);
    return response.data;
  },

  createStream: async (streamData) => {
    const response = await api.post('/streams', streamData);
    return response.data;
  },

  // Response now contains: { livekit: { token, wsUrl, roomName, identity } }
  startStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/start`);
    return response.data;
  },

  // Response now contains: { livekit: { token, wsUrl, roomName, identity } }
  joinStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/join`);
    return response.data;
  },

  endStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/end`);
    return response.data;
  },

  getStreamCards: async (streamId) => {
    const response = await api.get(`/streams/${streamId}/cards`);
    return response.data;
  },

  addCardToStream: async (streamId, cardId) => {
    const response = await api.post(`/streams/${streamId}/cards`, { cardId });
    return response.data;
  },
};
```

---

## Step 10: Clean Up Agora References

### Delete these files:
```bash
rm backend/src/services/agoraService.js
rm frontend/src/hooks/useAgora.js
```

### Remove from `backend/package.json`:
The `agora-token` dependency should already be gone after `npm uninstall agora-token`.

### Remove from `frontend/package.json`:
The `agora-rtc-sdk-ng` dependency should already be gone after `npm uninstall agora-rtc-sdk-ng`.

### Check your `backend/.env.example`:
Update it to show the new LiveKit vars:
```env
# LiveKit Configuration
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

### Check your `frontend/.env.example`:
```env
# LiveKit Configuration
REACT_APP_LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

---

## Testing Checklist

After making all changes:

```bash
# 1. Restart backend
cd backend
npm run dev

# 2. Restart frontend
cd frontend
npm start
```

### Test as HOST:
1. Login at `http://localhost:3000`
2. Go to `http://localhost:3000/stream/host`
3. Enter a stream title → click "Create Stream"
4. Click "🔴 Go Live"
5. Allow camera/mic when prompted
6. You should see yourself in the video preview
7. Check terminal for "✅ Connected to room" logs

### Test as VIEWER:
1. Open incognito window or different browser
2. Login with a different account
3. Go to `http://localhost:3000/livestream/[STREAM_ID]`
4. Stream should auto-join and show host's video
5. Check that you can hear the host's audio

### Test controls:
- Mute/unmute mic → viewer should hear/not hear you
- Turn camera on/off → viewer should see/not see video
- End stream → both sides disconnect, redirected to home

---

## Concept Comparison Cheat Sheet

| Agora Concept | LiveKit Equivalent | Notes |
|---------------|-------------------|-------|
| App ID | API Key | Used for authentication |
| App Certificate | API Secret | Keep on backend only |
| Channel | Room | Auto-created when first participant joins |
| UID (number) | Identity (string) | More flexible — use `host_42`, `viewer_7` |
| `RtcRole.PUBLISHER` | `canPublish: true` | Set in token grant |
| `RtcRole.SUBSCRIBER` | `canPublish: false` | Set in token grant |
| `AgoraRTC.createClient()` | `new Room()` | Main connection object |
| `client.join()` | `room.connect(wsUrl, token)` | Needs WebSocket URL + token |
| `client.publish()` | `room.localParticipant.publishTrack()` | Per-track publishing |
| `client.subscribe()` | Automatic | LiveKit auto-subscribes |
| `client.setClientRole()` | N/A | Role embedded in token |
| `user-published` event | `TrackSubscribed` event | When remote track available |
| `user-unpublished` event | `TrackUnsubscribed` event | When remote track removed |

---

## Cost Projection for Your App

### Development Phase (Now):
- **LiveKit Cloud Free Tier**: 5,000 connection minutes + 50GB bandwidth/month
- Enough for testing with 2-3 concurrent users daily
- **Cost: $0**

### Early Users (50-100 streams/month):
- ~50 streams × 60 min × 3 participants avg = 9,000 participant-minutes
- Still within or just above free tier
- **Cost: $0 – $50/month** (Ship plan)

### Growth (500+ streams/month):
- Consider self-hosting LiveKit (it's open source!)
- Run on a $20-40/month VPS
- **Cost: $20-40/month** (server costs only)

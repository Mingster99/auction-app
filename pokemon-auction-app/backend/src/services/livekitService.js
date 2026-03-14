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
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomCreate: true,
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
      roomJoin: true,
      room: roomName,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
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

const { RtcTokenBuilder, RtcRole } = require('agora-token');

const agoraService = {
  /**
   * Generate Agora RTC token for a user to join a channel
   * @param {string} channelName - Stream/channel name
   * @param {number} uid - User ID (0 for auto-assign)
   * @param {string} role - 'publisher' or 'audience'
   * @returns {object} Token and channel info
   */
  generateRtcToken: (channelName, uid = 0, role = 'audience') => {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId) {
      throw new Error('AGORA_APP_ID not configured');
    }

    // For testing mode (no certificate), return token without building
    if (!appCertificate) {
      return {
        token: null, // Agora testing mode doesn't require token
        appId,
        channelName,
        uid
      };
    }

    // Token expires in 24 hours
    const expirationTimeInSeconds = 86400;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Determine role
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Build token
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      agoraRole,
      privilegeExpiredTs
    );

    return {
      token,
      appId,
      channelName,
      uid,
      expiresAt: privilegeExpiredTs
    };
  },

  /**
   * Generate token for stream host (publisher)
   */
  generateHostToken: (channelName, uid) => {
    return agoraService.generateRtcToken(channelName, uid, 'publisher');
  },

  /**
   * Generate token for viewer (audience)
   */
  generateViewerToken: (channelName, uid) => {
    return agoraService.generateRtcToken(channelName, uid, 'audience');
  }
};

module.exports = agoraService;

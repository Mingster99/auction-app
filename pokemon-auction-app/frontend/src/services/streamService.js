import api from './api';

export const streamService = {
  // Get all active livestreams
  getActiveStreams: async () => {
    const response = await api.get('/streams/active');
    return response.data;
  },

  // Get stream by ID
  getStreamById: async (streamId) => {
    const response = await api.get(`/streams/${streamId}`);
    return response.data;
  },

  // Create new livestream
  createStream: async (streamData) => {
    const response = await api.post('/streams', streamData);
    return response.data;
  },

  // Start livestream (go live)
  startStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/start`);
    return response.data;
  },

  // Join stream as viewer (get Agora token)
  joinStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/join`);
    return response.data;
  },

  // End livestream
  endStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/end`);
    return response.data;
  },

  // Get cards queued for stream
  getStreamCards: async (streamId) => {
    const response = await api.get(`/streams/${streamId}/cards`);
    return response.data;
  },

  // Add card to stream queue
  addCardToStream: async (streamId, cardId) => {
    const response = await api.post(`/streams/${streamId}/cards`, { cardId });
    return response.data;
  },

  // Schedule a stream
  scheduleStream: async (streamData) => {
    const response = await api.post('/streams/schedule', streamData);
    return response.data;
  },

  // Get upcoming scheduled streams
  getUpcomingStreams: async () => {
    const response = await api.get('/streams/upcoming');
    return response.data;
  },

  // Get seller's own streams
  getMyStreams: async () => {
    const response = await api.get('/streams/my-streams');
    return response.data;
  },

  // Go live on a scheduled stream
  goLive: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/go-live`);
    return response.data;
  },

  // Toggle notification subscription
  toggleNotification: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/notify-me`);
    return response.data;
  },

  // Check notification status
  getNotificationStatus: async (streamId) => {
    const response = await api.get(`/streams/${streamId}/notify-status`);
    return response.data;
  },
};

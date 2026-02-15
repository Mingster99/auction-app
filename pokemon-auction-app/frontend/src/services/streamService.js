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

  // Start livestream
  startStream: async (streamId) => {
    const response = await api.post(`/streams/${streamId}/start`);
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
  }
};

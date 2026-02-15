import api from './api';

export const cardService = {
  // Get all cards
  getAllCards: async (filters = {}) => {
    const response = await api.get('/cards', { params: filters });
    return response.data;
  },

  // Get single card by ID
  getCardById: async (cardId) => {
    const response = await api.get(`/cards/${cardId}`);
    return response.data;
  },

  // Create new card listing
  createCard: async (cardData) => {
    const response = await api.post('/cards', cardData);
    return response.data;
  },

  // Update card
  updateCard: async (cardId, cardData) => {
    const response = await api.put(`/cards/${cardId}`, cardData);
    return response.data;
  },

  // Delete card
  deleteCard: async (cardId) => {
    const response = await api.delete(`/cards/${cardId}`);
    return response.data;
  },

  // Upload card image
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/cards/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

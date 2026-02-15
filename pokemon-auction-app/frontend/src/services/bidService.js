import api from './api';

export const bidService = {
  // Get bids for a specific card/auction
  getBidsForCard: async (cardId) => {
    const response = await api.get(`/bids/card/${cardId}`);
    return response.data;
  },

  // Place a bid
  placeBid: async (cardId, amount) => {
    const response = await api.post('/bids', { cardId, amount });
    return response.data;
  },

  // Get user's bid history
  getUserBids: async () => {
    const response = await api.get('/bids/user');
    return response.data;
  },

  // Get current highest bid for a card
  getCurrentBid: async (cardId) => {
    const response = await api.get(`/bids/card/${cardId}/current`);
    return response.data;
  }
};

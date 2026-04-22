import api from './api';

export const userService = {
  addPaymentMethod: async () => {
    const response = await api.post('/users/me/payment-method');
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get('/users/me/notifications');
    return response.data;
  },
};

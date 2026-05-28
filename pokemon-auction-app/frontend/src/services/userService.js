import api from './api';

export const userService = {
  // Step 1: get Airwallex customer clientSecret for card element
  initPaymentMethod: async () => {
    const response = await api.post('/users/me/payment-method');
    return response.data; // { clientSecret, customerId }
  },

  // Step 2: save consentId after frontend confirmed the card with Airwallex.js
  confirmPaymentMethod: async (consentId) => {
    const response = await api.put('/users/me/payment-method', { consentId });
    return response.data; // { message, user }
  },

  // Legacy alias (used in old PaymentMethodPage stub)
  addPaymentMethod: async () => {
    const response = await api.post('/users/me/payment-method');
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get('/users/me/notifications');
    return response.data;
  },
};

import api from './api';

export const sellerService = {
  getOverview: async () => {
    const response = await api.get('/seller/overview');
    return response.data;
  },

  getInvoices: async (params = {}) => {
    const response = await api.get('/seller/invoices', { params });
    return response.data;
  },

  getStreams: async () => {
    const response = await api.get('/seller/streams');
    return response.data;
  },
};

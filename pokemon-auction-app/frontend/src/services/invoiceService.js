import api from './api';

export const CARRIERS = ['USPS', 'SingPost', 'DHL', 'FedEx', 'UPS', 'Other'];

export const invoiceService = {
  getMy: async (params = {}) => {
    const response = await api.get('/invoices/my', { params });
    return response.data;
  },

  getOne: async (id) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  markShipped: async (id, body) => {
    const response = await api.post(`/invoices/${id}/ship`, body);
    return response.data;
  },
};

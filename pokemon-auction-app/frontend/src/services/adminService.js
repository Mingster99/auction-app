import api from './api';

export const adminService = {
  getPendingReview: async (params = {}) => {
    const response = await api.get('/admin/invoices/pending-review', { params });
    return response.data;
  },

  approveShipment: async (id, notes) => {
    const response = await api.post(`/admin/invoices/${id}/approve`, { notes });
    return response.data;
  },

  rejectShipment: async (id, notes) => {
    const response = await api.post(`/admin/invoices/${id}/reject`, { notes });
    return response.data;
  },
};

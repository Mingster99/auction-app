import api from './api';

export const profileService = {
  getOverview: async () => {
    const response = await api.get('/profile/overview');
    return response.data;
  },

  updateDetails: async (fields) => {
    const response = await api.patch('/profile/details', fields);
    return response.data;
  },
};

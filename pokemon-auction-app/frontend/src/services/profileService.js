import api from './api';

export const profileService = {
  getOverview: async () => {
    const response = await api.get('/profile/overview');
    return response.data;
  },
};

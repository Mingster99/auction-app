import api from './api';

export const authService = {
  // Login user
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Register new user
  signup: async (email, password, username) => {
    const response = await api.post('/auth/signup', { email, password, username });
    return response.data;
  },

  // Get current user info
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Logout (token removal handled in AuthContext)
  logout: () => {
    localStorage.removeItem('token');
  }
};

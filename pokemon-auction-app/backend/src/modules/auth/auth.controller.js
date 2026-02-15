const authService = require('./auth.service');

const authController = {
  // Register new user
  signup: async (req, res, next) => {
    try {
      const { email, password, username } = req.body;

      // Validation
      if (!email || !password || !username) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      const result = await authService.signup(email, password, username);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  // Login user
  login: async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const result = await authService.login(email, password);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  // Get current user
  getCurrentUser: async (req, res, next) => {
    try {
      const user = await authService.getUserById(req.user.id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;

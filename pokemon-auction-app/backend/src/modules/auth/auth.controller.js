const authService = require('./auth.service');

const authController = {
  // Register new user
  signup: async (req, res, next) => {
    try {
      const { email, password, username, address_line1, address_line2, city, state, postal_code, country, phone } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (!address_line1 || !city || !postal_code || !country) {
        return res.status(400).json({ message: 'Address (line 1, city, postal code, country) is required' });
      }

      const result = await authService.signup(email, password, username, {
        address_line1, address_line2: address_line2 || null, city, state: state || null, postal_code, country,
        phone: phone || null,
      });
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

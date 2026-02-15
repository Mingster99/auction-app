const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/users/:id - Get user profile
router.get('/:id', async (req, res) => {
  res.json({ message: 'Get user profile - Coming soon' });
});

// PUT /api/users/:id - Update user profile (protected)
router.put('/:id', authMiddleware, async (req, res) => {
  res.json({ message: 'Update user profile - Coming soon' });
});

module.exports = router;

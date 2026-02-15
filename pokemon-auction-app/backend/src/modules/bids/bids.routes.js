const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/bids/card/:cardId - Get bids for a card
router.get('/card/:cardId', async (req, res) => {
  res.json([]);
});

// POST /api/bids - Place a bid (protected)
router.post('/', authMiddleware, async (req, res) => {
  res.json({ message: 'Place bid - Coming soon' });
});

// GET /api/bids/user - Get user's bids (protected)
router.get('/user', authMiddleware, async (req, res) => {
  res.json([]);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/cards - Get all cards
router.get('/', async (req, res) => {
  res.json({ message: 'Cards endpoint - Coming soon' });
});

// GET /api/cards/:id - Get card by ID
router.get('/:id', async (req, res) => {
  res.json({ message: 'Get card by ID - Coming soon' });
});

// POST /api/cards - Create new card (protected)
router.post('/', authMiddleware, async (req, res) => {
  res.json({ message: 'Create card - Coming soon' });
});

module.exports = router;

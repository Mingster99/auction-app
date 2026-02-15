const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/streams/active - Get all active streams
router.get('/active', async (req, res) => {
  res.json([]);
});

// GET /api/streams/:id - Get stream by ID
router.get('/:id', async (req, res) => {
  res.json({ message: 'Get stream by ID - Coming soon' });
});

// POST /api/streams - Create new stream (protected)
router.post('/', authMiddleware, async (req, res) => {
  res.json({ message: 'Create stream - Coming soon' });
});

module.exports = router;

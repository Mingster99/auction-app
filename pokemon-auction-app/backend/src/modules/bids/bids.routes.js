const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/bids/card/:cardId - Get bids for a card
router.get('/card/:cardId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.amount, b.placed_at, b.is_winning_bid,
              u.username, u.id AS bidder_id
       FROM bids b
       JOIN users u ON u.id = b.bidder_id
       WHERE b.card_id = $1
       ORDER BY b.placed_at DESC
       LIMIT 50`,
      [req.params.cardId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching bids:', err);
    res.status(500).json({ message: 'Failed to fetch bids' });
  }
});

// GET /api/bids/user - Get authenticated user's bid history
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.amount, b.placed_at, b.is_winning_bid,
              c.name AS card_name, c.card_image_front, c.image_url,
              c.psa_grade, c.auction_status, c.current_bid,
              c.id AS card_id, c.stream_id
       FROM bids b
       JOIN cards c ON c.id = b.card_id
       WHERE b.bidder_id = $1
       ORDER BY b.placed_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching user bids:', err);
    res.status(500).json({ message: 'Failed to fetch bid history' });
  }
});

module.exports = router;

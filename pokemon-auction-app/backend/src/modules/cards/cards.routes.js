const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');

// Get all cards
router.get('/', async (req, res, next) => {
  try {
    const limit = req.query.limit || 8;
    const result = await pool.query(
      `SELECT c.*, u.username as seller_name
       FROM cards c
       JOIN users u ON c.seller_id = u.id
       WHERE c.auction_status NOT IN ('ended', 'sold')
       ORDER BY c.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get card by ID
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.username as seller_name
       FROM cards c
       JOIN users u ON c.seller_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Card not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create a card (protected - must be logged in)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, set, rarity, condition, grading, description, imageUrl, backImageUrl, startingBid, buyoutPrice, reservePrice, auctionDurationSeconds, tcgGame } = req.body;

    if (!name || !startingBid) {
      return res.status(400).json({ message: 'Name and starting bid required' });
    }

    const result = await pool.query(
      `INSERT INTO cards (seller_id, name, set, rarity, condition, grading, description, image_url, card_image_front, card_image_back, starting_bid, status, buyout_price, reserve_price, auction_duration_seconds, tcg_game)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, $14, $15)
       RETURNING *`,
      [req.user.id, name, set, rarity, condition, grading, description, imageUrl || null, imageUrl || null, backImageUrl || null, startingBid, buyoutPrice || null, reservePrice || null, auctionDurationSeconds || 60, tcgGame || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
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
       WHERE c.status = 'active'
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
    const { name, set, rarity, condition, grading, description, imageUrl, startingBid } = req.body;

    if (!name || !startingBid) {
      return res.status(400).json({ message: 'Name and starting bid required' });
    }

    const result = await pool.query(
      `INSERT INTO cards (seller_id, name, set, rarity, condition, grading, description, image_url, starting_bid, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING *`,
      [req.user.id, name, set, rarity, condition, grading, description, imageUrl, startingBid]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
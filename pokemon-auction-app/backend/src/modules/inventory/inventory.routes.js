const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');

// ============================================================
// INVENTORY ROUTES
// ============================================================
// All routes require auth — they operate on the logged-in user's cards.
//
// GET    /api/inventory            — User's full card inventory
// PATCH  /api/inventory/:id/price  — Update starting bid
// PATCH  /api/inventory/:id/queue  — Toggle queued for next stream
// GET    /api/inventory/queue      — Get user's stream queue
// GET    /api/inventory/upcoming   — Public: all cards queued for streams
// DELETE /api/inventory/:id        — Remove card from inventory
// ============================================================


// ── GET USER INVENTORY ───────────────────────────────────
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cards
       WHERE seller_id = $1
       ORDER BY queued_for_stream DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});


// ── UPDATE STARTING BID ─────────────────────────────────
router.patch('/:id/price', authMiddleware, async (req, res, next) => {
  try {
    const { startingBid } = req.body;
    const cardId = req.params.id;

    if (startingBid === undefined || startingBid === null) {
      return res.status(400).json({ message: 'Starting bid is required' });
    }

    const bid = parseFloat(startingBid);
    if (isNaN(bid) || bid < 0) {
      return res.status(400).json({ message: 'Starting bid must be a valid positive number' });
    }

    const result = await pool.query(
      `UPDATE cards
       SET starting_bid = $1, updated_at = NOW()
       WHERE id = $2 AND seller_id = $3
       RETURNING *`,
      [bid, cardId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Card not found or not yours' });
    }

    res.json({ message: 'Price updated', card: result.rows[0] });
  } catch (error) {
    next(error);
  }
});


// ── TOGGLE STREAM QUEUE ──────────────────────────────────
router.patch('/:id/queue', authMiddleware, async (req, res, next) => {
  try {
    const cardId = req.params.id;
    const { queued } = req.body; // true or false

    // Verify card belongs to user
    const card = await pool.query(
      'SELECT id, queued_for_stream FROM cards WHERE id = $1 AND seller_id = $2',
      [cardId, req.user.id]
    );

    if (card.rows.length === 0) {
      return res.status(404).json({ message: 'Card not found or not yours' });
    }

    const newQueued = queued !== undefined ? Boolean(queued) : !card.rows[0].queued_for_stream;

    const result = await pool.query(
      `UPDATE cards
       SET queued_for_stream = $1,
           queued_at = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $4 AND seller_id = $5
       RETURNING *`,
      [
        newQueued,
        newQueued ? new Date() : null,
        newQueued ? 'active' : 'pending',
        cardId,
        req.user.id,
      ]
    );

    res.json({
      message: newQueued ? 'Card added to stream queue' : 'Card removed from stream queue',
      card: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});


// ── GET USER'S STREAM QUEUE ──────────────────────────────
router.get('/queue', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cards
       WHERE seller_id = $1 AND queued_for_stream = true
       ORDER BY queued_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});


// ── PUBLIC: UPCOMING STREAM CARDS ────────────────────────
// Any user can see what cards are queued for upcoming streams
router.get('/upcoming', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.set, c.rarity, c.condition, c.grading,
              c.starting_bid, c.image_url, c.card_image_front,
              c.psa_cert_number, c.psa_grade, c.psa_grade_description,
              c.queued_at, u.username as seller_name
       FROM cards c
       JOIN users u ON c.seller_id = u.id
       WHERE c.queued_for_stream = true
       ORDER BY c.queued_at ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});


// ── DELETE CARD ──────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM cards WHERE id = $1 AND seller_id = $2 RETURNING id, name',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Card not found or not yours' });
    }

    res.json({ message: 'Card deleted', card: result.rows[0] });
  } catch (error) {
    next(error);
  }
});


module.exports = router;

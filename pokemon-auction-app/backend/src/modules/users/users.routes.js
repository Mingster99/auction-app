const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');

// GET /api/users/me/notifications - recent "stream going live" notifications for the authed user
router.get('/me/notifications', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sn.stream_id, sn.created_at AS subscribed_at, sn.notified,
              s.title, s.started_at, s.status,
              u.username AS host_name
       FROM stream_notifications sn
       JOIN streams s ON s.id = sn.stream_id
       JOIN users u ON u.id = s.host_id
       WHERE sn.user_id = $1
         AND sn.notified = true
         AND s.started_at > NOW() - INTERVAL '7 days'
       ORDER BY s.started_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/payment-method - stub that flips has_payment_method = true
router.post('/me/payment-method', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET has_payment_method = true
       WHERE id = $1
       RETURNING id, username, email, avatar_url, rating, is_verified, is_verified_seller, has_payment_method, created_at`,
      [req.user.id]
    );
    res.json({ message: 'Payment method added', user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id - Get user profile
router.get('/:id', async (req, res) => {
  res.json({ message: 'Get user profile - Coming soon' });
});

// PUT /api/users/:id - Update user profile (protected)
router.put('/:id', authMiddleware, async (req, res) => {
  res.json({ message: 'Update user profile - Coming soon' });
});

module.exports = router;

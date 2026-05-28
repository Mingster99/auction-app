const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const airwallexService = require('../../utils/airwallexService');

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

// POST /api/users/me/payment-method
// Step 1: create Airwallex customer + payment consent, return clientSecret for frontend to confirm.
router.post('/me/payment-method', authMiddleware, async (req, res, next) => {
  try {
    const { id: userId, email } = req.user;

    // Re-use existing customer if already created
    const { rows } = await pool.query(
      'SELECT airwallex_customer_id FROM users WHERE id = $1',
      [userId]
    );
    let customerId = rows[0]?.airwallex_customer_id;
    if (!customerId) {
      customerId = await airwallexService.createCustomer(userId, email);
      await pool.query(
        'UPDATE users SET airwallex_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }

    const clientSecret = await airwallexService.generateCustomerClientSecret(customerId);
    res.json({ clientSecret, customerId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me/payment-method
// Step 2: frontend confirmed the consent — save the consentId and activate the payment flag.
router.put('/me/payment-method', authMiddleware, async (req, res, next) => {
  try {
    const { consentId } = req.body;
    if (!consentId) return res.status(400).json({ message: 'consentId is required' });

    const { rows } = await pool.query(
      `UPDATE users
       SET airwallex_consent_id = $1, has_payment_method = true
       WHERE id = $2
       RETURNING id, username, email, avatar_url, rating, is_verified, is_verified_seller,
                 has_payment_method, is_admin, created_at`,
      [consentId, req.user.id]
    );
    res.json({ message: 'Payment method saved', user: rows[0] });
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

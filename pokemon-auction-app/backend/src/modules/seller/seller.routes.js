const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const sellerController = require('./seller.controller');

// Verify the authenticated user is a verified seller. authMiddleware only puts
// id/email/username on req.user, so we need a DB read for the role flag.
const requireVerifiedSeller = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT is_verified_seller FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]?.is_verified_seller) {
      return res.status(403).json({ message: 'Verified seller account required' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

router.use(authMiddleware, requireVerifiedSeller);

router.get('/overview', sellerController.getOverview);
router.get('/invoices', sellerController.getInvoices);
router.get('/streams', sellerController.getStreams);

module.exports = router;

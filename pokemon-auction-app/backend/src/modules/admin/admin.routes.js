const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const adminController = require('./admin.controller');

// Verify the authenticated user has the is_admin flag. authMiddleware only
// puts id/email/username on req.user, so we check the role with a DB read.
const requireAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]?.is_admin) {
      return res.status(403).json({ message: 'Admin account required' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

router.use(authMiddleware, requireAdmin);

router.get('/invoices/pending-review', adminController.getPendingReview);
router.post('/invoices/:id/approve', adminController.approveShipment);
router.post('/invoices/:id/reject', adminController.rejectShipment);

module.exports = router;

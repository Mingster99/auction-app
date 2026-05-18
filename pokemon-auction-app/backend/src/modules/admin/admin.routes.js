const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const adminController = require('./admin.controller');

// Verify the authenticated user has is_admin flag.
const requireAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_admin) return res.status(403).json({ message: 'Admin account required' });
    next();
  } catch (err) {
    next(err);
  }
};

// Verify the short-lived admin token (1 h) sent in X-Admin-Token header.
// This gates all money-touching delivery actions.
const requireAdminTOTP = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken) return res.status(403).json({ code: 'TOTP_REQUIRED', message: 'TOTP verification required' });
  try {
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
    if (!decoded.admin_verified_at) {
      return res.status(403).json({ code: 'TOTP_REQUIRED', message: 'TOTP verification required' });
    }
    if (Date.now() - decoded.admin_verified_at > 3600 * 1000) {
      return res.status(403).json({ code: 'TOTP_EXPIRED', message: 'Admin session expired — re-validate TOTP' });
    }
    next();
  } catch (err) {
    return res.status(403).json({ code: 'TOTP_REQUIRED', message: 'Invalid admin token' });
  }
};

// ── TOTP routes (auth only, no admin_totp check — that's what these set up) ──
router.get('/totp/setup',      authMiddleware, requireAdmin, adminController.setupTotp);
router.post('/totp/setup',     authMiddleware, requireAdmin, adminController.activateTotp);
router.post('/totp/validate',  authMiddleware, requireAdmin, adminController.validateTotp);

// ── Read-only admin routes ────────────────────────────────────────────────
router.get('/sales',           authMiddleware, requireAdmin, adminController.getAllSales);
router.get('/audit-log',       authMiddleware, requireAdmin, adminController.getAuditLog);

// ── Money-touching delivery routes (require TOTP) ─────────────────────────
router.post('/sellers/:sellerId/schedule-pickup-batch', authMiddleware, requireAdmin, requireAdminTOTP, adminController.scheduleBatchPickup);
router.post('/invoices/:id/schedule-pickup',  authMiddleware, requireAdmin, requireAdminTOTP, adminController.schedulePickup);
router.post('/invoices/:id/confirm-pickup',   authMiddleware, requireAdmin, requireAdminTOTP, adminController.confirmPickup);
router.post('/invoices/:id/confirm-delivery', authMiddleware, requireAdmin, requireAdminTOTP, adminController.confirmDelivery);

module.exports = router;

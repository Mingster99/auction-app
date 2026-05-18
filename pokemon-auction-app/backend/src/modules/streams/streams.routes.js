const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const authMiddleware = require('../../middleware/auth.middleware');
const streamsController = require('./streams.controller');

const requireVerifiedSeller = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT is_verified_seller FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]?.is_verified_seller) {
      return res.status(403).json({ message: 'Only verified sellers can host streams' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Public routes
router.get('/active', streamsController.getActiveStreams);
router.get('/upcoming', streamsController.getUpcomingStreams);
router.get('/:id/queue', streamsController.getStreamQueue);

// Protected routes (require authentication)
router.get('/my-streams', authMiddleware, streamsController.getMyStreams);
router.post('/', authMiddleware, requireVerifiedSeller, streamsController.createStream);
router.post('/schedule', authMiddleware, requireVerifiedSeller, streamsController.scheduleStream);
router.post('/:id/start', authMiddleware, requireVerifiedSeller, streamsController.startStream);
router.post('/:id/join', authMiddleware, streamsController.joinStream);
router.post('/:id/end', authMiddleware, requireVerifiedSeller, streamsController.endStream);
router.post('/:id/go-live', authMiddleware, requireVerifiedSeller, streamsController.goLive);
router.post('/:id/notify-me', authMiddleware, streamsController.toggleNotification);
router.get('/:id/notify-status', authMiddleware, streamsController.getNotificationStatus);

// Chat history (public — viewers can load history on join)
router.get('/:id/chat', streamsController.getChatHistory);

// Chat ban list (host only)
router.get('/:id/bans', authMiddleware, streamsController.getStreamBans);

// This must be last (catches /:id pattern)
router.get('/:id', streamsController.getStreamById);

module.exports = router;

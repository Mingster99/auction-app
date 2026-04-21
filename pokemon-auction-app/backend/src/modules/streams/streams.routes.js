const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const streamsController = require('./streams.controller');

// Public routes
router.get('/active', streamsController.getActiveStreams);
router.get('/upcoming', streamsController.getUpcomingStreams);

// Protected routes (require authentication)
router.get('/my-streams', authMiddleware, streamsController.getMyStreams);
router.post('/', authMiddleware, streamsController.createStream);
router.post('/schedule', authMiddleware, streamsController.scheduleStream);
router.post('/:id/start', authMiddleware, streamsController.startStream);
router.post('/:id/join', authMiddleware, streamsController.joinStream);
router.post('/:id/end', authMiddleware, streamsController.endStream);
router.post('/:id/go-live', authMiddleware, streamsController.goLive);
router.post('/:id/notify-me', authMiddleware, streamsController.toggleNotification);
router.get('/:id/notify-status', authMiddleware, streamsController.getNotificationStatus);

// This must be last (catches /:id pattern)
router.get('/:id', streamsController.getStreamById);

module.exports = router;

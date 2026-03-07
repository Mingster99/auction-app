const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const streamsController = require('./streams.controller');

// Public routes
router.get('/active', streamsController.getActiveStreams);
router.get('/:id', streamsController.getStreamById);

// Protected routes (require authentication)
router.post('/', authMiddleware, streamsController.createStream);
router.post('/:id/start', authMiddleware, streamsController.startStream);
router.post('/:id/join', authMiddleware, streamsController.joinStream);
router.post('/:id/end', authMiddleware, streamsController.endStream);

module.exports = router;

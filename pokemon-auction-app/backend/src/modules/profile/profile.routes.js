const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const profileController = require('./profile.controller');

router.use(authMiddleware);
router.get('/overview', profileController.getOverview);

module.exports = router;

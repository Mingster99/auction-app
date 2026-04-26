const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const invoicesController = require('./invoices.controller');

router.use(authMiddleware);

router.get('/my', invoicesController.getMy);
router.get('/:id', invoicesController.getOne);
router.post('/:id/ship', invoicesController.markShipped);

module.exports = router;

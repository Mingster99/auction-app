const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const invoicesController = require('./invoices.controller');

router.use(authMiddleware);

router.get('/my', invoicesController.getMy);
router.post('/:id/retry-payment', invoicesController.retryPayment);
router.get('/:id', invoicesController.getOne);

module.exports = router;

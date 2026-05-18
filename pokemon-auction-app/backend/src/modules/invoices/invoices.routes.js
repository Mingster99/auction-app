const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const invoicesController = require('./invoices.controller');

router.use(authMiddleware);

router.get('/my', invoicesController.getMy);
router.get('/:id', invoicesController.getOne);
// markShipped removed — seller shipping replaced by admin pickup flow

module.exports = router;

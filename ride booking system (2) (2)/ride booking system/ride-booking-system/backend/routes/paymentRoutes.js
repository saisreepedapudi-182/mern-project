const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/', paymentController.makePayment);
router.get('/', paymentController.getPayments);

module.exports = router;

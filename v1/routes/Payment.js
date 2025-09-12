const Controller = require('../controller/PaymentController');
const router = require('express').Router();

//Payment
router.get("/payment_callback", Controller.PesapalPayment.payment);

module.exports = router;
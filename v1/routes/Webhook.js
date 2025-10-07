const express = require('express');
const router = express.Router();
const Controller = require('../controller');

// Dyte webhook endpoints (simplified for testing)
router.post('/dyte', Controller.WebhookController.handleDyteWebhook);
router.get('/dyte/health', Controller.WebhookController.webhookHealthCheck);

module.exports = router;

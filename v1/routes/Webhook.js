const express = require('express');
const router = express.Router();
const Controller = require('../controller');

// Dyte webhook endpoints
router.post('/dyte', Controller.WebhookController.handleDyteWebhook);
router.get('/dyte/health', Controller.WebhookController.webhookHealthCheck);

// Meeting Analytics APIs
router.get('/meeting/chat-analytics/:classId/:slotId', Controller.WebhookController.getChatAnalytics);
router.get('/meeting/analytics/:classId/:slotId', Controller.WebhookController.getMeetingAnalytics);

module.exports = router;

const express = require('express');
const router = express.Router();
const Controller = require('../controller');

// Dyte webhook endpoints (simplified for testing)
router.post('/dyte', Controller.WebhookController.handleDyteWebhook);
router.get('/dyte/health', Controller.WebhookController.webhookHealthCheck);

// Meeting data retrieval APIs
router.get('/meeting/chat/:classId/:slotId', Controller.WebhookController.getChatByClassSlot);
router.get('/meeting/session/:classId/:slotId', Controller.WebhookController.getSessionByClassSlot);
router.get('/meeting/participants/:classId/:slotId', Controller.WebhookController.getParticipantsByClassSlot);
router.get('/meeting/events/:classId/:slotId', Controller.WebhookController.getEventsByClassSlot);
router.get('/meeting/recording/:classId/:slotId', Controller.WebhookController.getRecordingByClassSlot);
router.get('/meeting/class/:classId', Controller.WebhookController.getAllMeetingsByClass);

module.exports = router;

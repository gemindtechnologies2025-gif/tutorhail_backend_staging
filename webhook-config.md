# Dyte Webhook Configuration Guide

## Environment Variables Required

Add these to your `.env.develop` file:

```bash
# Dyte Webhook Configuration
DYTE_WEBHOOK_SECRET=your_webhook_secret_here
DYTE_API_KEY=your_dyte_api_key_here
```

## Webhook Endpoints

### Main Webhook Endpoint
```
POST /api/v1/webhook/dyte
```

### Health Check Endpoint
```
GET /api/v1/webhook/dyte/health
```

## Supported Webhook Events

1. **meeting.started** - When a meeting begins
2. **meeting.ended** - When a meeting ends
3. **participant.joined** - When someone joins the meeting
4. **participant.left** - When someone leaves the meeting
5. **recording.uploaded** - When a recording is uploaded
6. **livestreaming.statusUpdate** - When livestream status changes

## Webhook Security

The webhook endpoint includes signature verification using HMAC-SHA256 to ensure requests are from Dyte.

Required headers:
- `dyte-webhook-id`: Unique webhook identifier
- `dyte-uuid`: Unique event identifier
- `dyte-signature`: HMAC-SHA256 signature for verification

## Testing Webhooks

### 1. Health Check
```bash
curl -X GET http://localhost:4001/api/v1/webhook/dyte/health
```

### 2. Test Webhook (with proper headers)
```bash
curl -X POST http://localhost:4001/api/v1/webhook/dyte \
  -H "Content-Type: application/json" \
  -H "dyte-webhook-id: test-webhook-id" \
  -H "dyte-uuid: test-uuid" \
  -H "dyte-signature: test-signature" \
  -d '{
    "event": "meeting.started",
    "meetingId": "test-meeting-123",
    "title": "Test Meeting",
    "participants": []
  }'
```

## Webhook Payload Examples

### Meeting Started
```json
{
  "event": "meeting.started",
  "meetingId": "meeting-123",
  "title": "Math Class",
  "participants": [
    {
      "userId": "user-123",
      "name": "John Doe"
    }
  ]
}
```

### Meeting Ended
```json
{
  "event": "meeting.ended",
  "meetingId": "meeting-123",
  "title": "Math Class",
  "duration": 3600,
  "participants": [
    {
      "userId": "user-123",
      "name": "John Doe"
    }
  ]
}
```

### Recording Uploaded
```json
{
  "event": "recording.uploaded",
  "meetingId": "meeting-123",
  "recordingUrl": "https://storage.dyte.io/recordings/recording-123.mp4",
  "duration": 3600,
  "size": 104857600
}
```

## Database Updates

The webhook handlers automatically update:

1. **Classes Collection**: Updates `dyteMeeting` field with meeting status, participants, recordings
2. **BookingsDetails Collection**: Updates meeting information
3. **Notifications**: Sends real-time notifications to participants

## Error Handling

- Invalid signatures return 401
- Missing headers return 400
- Processing errors return 500
- All webhooks return 200 on successful processing

## Monitoring

Check application logs for webhook processing:
- Successful webhook processing
- Signature verification failures
- Database update errors
- Notification sending errors

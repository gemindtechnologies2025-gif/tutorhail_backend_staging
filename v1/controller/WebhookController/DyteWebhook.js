const crypto = require('crypto');
const Model = require('../../../models');
const constants = require('../../../common/constants');
const services = require('../../../services');

/**
 * Verify Dyte webhook signature for security
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from dyte-signature header
 * @param {string} webhookSecret - Webhook secret from environment
 * @returns {boolean} - Whether signature is valid
 */
function verifyDyteSignature(payload, signature, webhookSecret) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying Dyte signature:', error);
    return false;
  }
}

/**
 * Handle meeting.started webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleMeetingStarted(payload) {
  try {
    console.log('Meeting started:', payload);
    
    const { meeting } = payload;
    const meetingId = meeting.id;
    const title = meeting.title;
    const sessionId = meeting.sessionId;
    const roomName = meeting.roomName;
    const organizedBy = meeting.organizedBy;
    
    // Update class status to "In Progress"
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.status': 'LIVE',
          'dyteMeeting.sessionId': sessionId,
          'dyteMeeting.roomName': roomName,
          'dyteMeeting.startedAt': new Date(meeting.startedAt),
          'dyteMeeting.organizedBy': organizedBy,
          status: constants.CLASS_STATUS.IN_PROGRESS 
        } 
      }
    );

    // Update booking details if exists
    await Model.BookingsDetails.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.status': 'LIVE',
          'dyteMeeting.sessionId': sessionId,
          'dyteMeeting.roomName': roomName,
          'dyteMeeting.startedAt': new Date(meeting.startedAt),
          'dyteMeeting.organizedBy': organizedBy
        } 
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Class Started',
        message: `Your class "${title}" has started`,
        type: 'class_started',
        data: { meetingId, title, sessionId }
      });
    }

    console.log(`Meeting ${meetingId} started successfully`);
  } catch (error) {
    console.error('Error handling meeting.started:', error);
  }
}

/**
 * Handle meeting.ended webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleMeetingEnded(payload) {
  try {
    console.log('Meeting ended:', payload);
    
    const { meeting, reason } = payload;
    const meetingId = meeting.id;
    const title = meeting.title;
    const sessionId = meeting.sessionId;
    const endedAt = meeting.endedAt;
    const organizedBy = meeting.organizedBy;
    
    // Calculate duration if both startedAt and endedAt are available
    let duration = null;
    if (meeting.startedAt && meeting.endedAt) {
      duration = Math.floor((new Date(meeting.endedAt) - new Date(meeting.startedAt)) / 1000);
    }
    
    // Update class status to "Completed"
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.status': 'ENDED',
          'dyteMeeting.endedAt': new Date(endedAt),
          'dyteMeeting.duration': duration,
          'dyteMeeting.endReason': reason,
          'dyteMeeting.organizedBy': organizedBy,
          status: constants.CLASS_STATUS.COMPLETED 
        } 
      }
    );

    // Update booking details if exists
    await Model.BookingsDetails.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.status': 'ENDED',
          'dyteMeeting.endedAt': new Date(endedAt),
          'dyteMeeting.duration': duration,
          'dyteMeeting.endReason': reason,
          'dyteMeeting.organizedBy': organizedBy
        } 
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Class Ended',
        message: `Your class "${title}" has ended`,
        type: 'class_ended',
        data: { meetingId, title, duration, reason }
      });
    }

    console.log(`Meeting ${meetingId} ended successfully. Reason: ${reason}`);
  } catch (error) {
    console.error('Error handling meeting.ended:', error);
  }
}

/**
 * Handle meeting.participantJoined webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleParticipantJoined(payload) {
  try {
    console.log('Participant joined:', payload);
    
    const { meeting, participant } = payload;
    const meetingId = meeting.id;
    const participantData = {
      peerId: participant.peerId,
      userDisplayName: participant.userDisplayName,
      customParticipantId: participant.customParticipantId,
      joinedAt: new Date(participant.joinedAt)
    };
    
    // Update participant count in class
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $inc: { 'dyteMeeting.participantCount': 1 },
        $push: { 
          'dyteMeeting.participants': participantData
        }
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Student Joined',
        message: `${participant.userDisplayName} joined the class`,
        type: 'participant_joined',
        data: { meetingId, participant: participantData }
      });
    }

    console.log(`Participant ${participant.userDisplayName} joined meeting ${meetingId}`);
  } catch (error) {
    console.error('Error handling meeting.participantJoined:', error);
  }
}

/**
 * Handle meeting.participantLeft webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleParticipantLeft(payload) {
  try {
    console.log('Participant left:', payload);
    
    const { meeting, participant } = payload;
    const meetingId = meeting.id;
    const participantData = {
      peerId: participant.peerId,
      userDisplayName: participant.userDisplayName,
      customParticipantId: participant.customParticipantId,
      joinedAt: new Date(participant.joinedAt),
      leftAt: new Date(participant.leftAt)
    };
    
    // Update participant count in class
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $inc: { 'dyteMeeting.participantCount': -1 },
        $pull: { 
          'dyteMeeting.participants': { peerId: participant.peerId }
        }
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Student Left',
        message: `${participant.userDisplayName} left the class`,
        type: 'participant_left',
        data: { meetingId, participant: participantData }
      });
    }

    console.log(`Participant ${participant.userDisplayName} left meeting ${meetingId}`);
  } catch (error) {
    console.error('Error handling meeting.participantLeft:', error);
  }
}

/**
 * Handle recording.statusUpdate webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleRecordingStatusUpdate(payload) {
  try {
    console.log('Recording status update:', payload);
    
    const { recording, meeting } = payload;
    const meetingId = meeting.id;
    const recordingData = {
      id: recording.id,
      recordingId: recording.recordingId,
      status: recording.status,
      startedTime: new Date(recording.startedTime),
      roomUUID: recording.roomUUID,
      outputFileName: recording.outputFileName
    };
    
    // Update class with recording information
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.recording': recordingData
        } 
      }
    );

    // Update booking details if exists
    await Model.BookingsDetails.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.recording': recordingData
        } 
      }
    );

    // Send notification when recording is uploaded
    if (recording.status === 'UPLOADED') {
      const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
      if (classData) {
        process.emit('newNotification', {
          userId: classData.tutorId,
          title: 'Recording Available',
          message: `Recording for your class is now available`,
          type: 'recording_uploaded',
          data: { meetingId, recording: recordingData }
        });
      }
    }

    console.log(`Recording status updated for meeting ${meetingId}: ${recording.status}`);
  } catch (error) {
    console.error('Error handling recording.statusUpdate:', error);
  }
}

/**
 * Handle meeting.chatSynced webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleChatSynced(payload) {
  try {
    console.log('Chat synced:', payload);
    
    const { meetingId, sessionId, chatDownloadUrl, chatDownloadUrlExpiry, organizedBy } = payload;
    
    // Update class with chat information
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.chat': {
            downloadUrl: chatDownloadUrl,
            downloadUrlExpiry: new Date(chatDownloadUrlExpiry),
            syncedAt: new Date()
          }
        } 
      }
    );

    console.log(`Chat synced for meeting ${meetingId}`);
  } catch (error) {
    console.error('Error handling meeting.chatSynced:', error);
  }
}

/**
 * Handle meeting.transcript webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleTranscript(payload) {
  try {
    console.log('Transcript available:', payload);
    
    const { meeting, transcriptDownloadUrl, transcriptDownloadUrlExpiry } = payload;
    const meetingId = meeting.id;
    
    // Update class with transcript information
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.transcript': {
            downloadUrl: transcriptDownloadUrl,
            downloadUrlExpiry: new Date(transcriptDownloadUrlExpiry),
            availableAt: new Date()
          }
        } 
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Transcript Available',
        message: `Transcript for your class is now available`,
        type: 'transcript_available',
        data: { meetingId, transcriptDownloadUrl }
      });
    }

    console.log(`Transcript available for meeting ${meetingId}`);
  } catch (error) {
    console.error('Error handling meeting.transcript:', error);
  }
}

/**
 * Handle meeting.summary webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleSummary(payload) {
  try {
    console.log('Summary available:', payload);
    
    const { meeting, summaryDownloadUrl, summaryDownloadUrlExpiry } = payload;
    const meetingId = meeting.id;
    
    // Update class with summary information
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.summary': {
            downloadUrl: summaryDownloadUrl,
            downloadUrlExpiry: new Date(summaryDownloadUrlExpiry),
            availableAt: new Date()
          }
        } 
      }
    );

    // Send notification to class participants
    const classData = await Model.Classes.findOne({ 'dyteMeeting.meetingId': meetingId });
    if (classData) {
      process.emit('newNotification', {
        userId: classData.tutorId,
        title: 'Summary Available',
        message: `Summary for your class is now available`,
        type: 'summary_available',
        data: { meetingId, summaryDownloadUrl }
      });
    }

    console.log(`Summary available for meeting ${meetingId}`);
  } catch (error) {
    console.error('Error handling meeting.summary:', error);
  }
}

/**
 * Handle livestreaming.statusUpdate webhook event
 * @param {Object} payload - Webhook payload
 */
async function handleLivestreamStatusUpdate(payload) {
  try {
    console.log('Livestream status update:', payload);
    
    const { meetingId, streamId, status } = payload;
    
    // Update class with livestream information
    await Model.Classes.findOneAndUpdate(
      { 'dyteMeeting.meetingId': meetingId },
      { 
        $set: { 
          'dyteMeeting.livestream': {
            streamId: streamId,
            status: status,
            updatedAt: new Date()
          }
        } 
      }
    );

    console.log(`Livestream status updated for meeting ${meetingId}: ${status}`);
  } catch (error) {
    console.error('Error handling livestreaming.statusUpdate:', error);
  }
}

/**
 * Main webhook handler
 */
module.exports.handleDyteWebhook = async (req, res, next) => {
  try {
    console.log('🔔 Webhook received:', req.body);
    
    // Get headers (optional for testing)
    const webhookId = req.headers['dyte-webhook-id'] || 'test-webhook-id';
    const uuid = req.headers['dyte-uuid'] || 'test-uuid';
    const signature = req.headers['dyte-signature'] || 'test-signature';

    // Extract event type and payload
    const { event, ...payload } = req.body;
    
    console.log(`📡 Processing webhook event: ${event}`, {
      webhookId,
      uuid,
      event,
      payload
    });

    // Route to appropriate handler based on event type
    switch (event) {
      case 'meeting.started':
        await handleMeetingStarted(payload);
        break;
      
      case 'meeting.ended':
        await handleMeetingEnded(payload);
        break;
      
      case 'meeting.participantJoined':
        await handleParticipantJoined(payload);
        break;
      
      case 'meeting.participantLeft':
        await handleParticipantLeft(payload);
        break;
      
      case 'recording.statusUpdate':
        await handleRecordingStatusUpdate(payload);
        break;
      
      case 'livestreaming.statusUpdate':
        await handleLivestreamStatusUpdate(payload);
        break;
      
      case 'meeting.chatSynced':
        await handleChatSynced(payload);
        break;
      
      case 'meeting.transcript':
        await handleTranscript(payload);
        break;
      
      case 'meeting.summary':
        await handleSummary(payload);
        break;
      
      default:
        console.log(`❓ Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      event: event,
      webhookId: webhookId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing Dyte webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Health check endpoint for webhook
 */
module.exports.webhookHealthCheck = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Dyte webhook endpoint is healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Webhook health check failed',
      error: error.message
    });
  }
};

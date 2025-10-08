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
 * Find the matching slot based on meeting start time
 * @param {string} classId - Class ID
 * @param {Date} meetingStartTime - Meeting start time
 * @param {Array} classSlotIds - Array of slot IDs from booking (optional)
 * @returns {ObjectId} - Slot ID or null
 */
async function findMatchingSlot(classId, meetingStartTime, classSlotIds = null) {
  try {
    if (!meetingStartTime) {
      return null;
    }

    const startTime = new Date(meetingStartTime);
    let slots = [];

    // If classSlotIds provided (from booking), fetch those specific slots
    if (classSlotIds && classSlotIds.length > 0) {
      slots = await Model.ClassSlots.find({
        _id: { $in: classSlotIds }
      });
    } 
    // Otherwise, find all slots for this class
    else if (classId) {
      slots = await Model.ClassSlots.find({
        classId: classId
      });
    }

    if (slots.length === 0) {
      console.log(`⚠️  No slots found for classId: ${classId}`);
      return null;
    }

    // Find the slot with startTime closest to meetingStartTime
    let closestSlot = null;
    let minDifference = Infinity;

    for (const slot of slots) {
      const slotStart = new Date(slot.startTime);
      const difference = Math.abs(slotStart - startTime);
      
      if (difference < minDifference) {
        minDifference = difference;
        closestSlot = slot;
      }
    }

    // Only consider it a match if within 30 minutes
    if (closestSlot && minDifference < 30 * 60 * 1000) {
      console.log(`✅ Found matching slot: ${closestSlot._id} (difference: ${Math.floor(minDifference / 1000)}s)`);
      return closestSlot._id;
    }

    console.log(`⚠️  No slot found within 30 minutes of meeting start time`);
    return null;
  } catch (error) {
    console.error('Error finding matching slot:', error);
    return null;
  }
}

/**
 * Find class or booking by meeting ID and also find the matching slot
 * Searches in both Classes and Bookings collections
 * @param {string} meetingId - Dyte meeting ID
 * @param {Date} meetingStartTime - Meeting start time (optional, for slot matching)
 * @returns {Object} - { source: 'class'|'booking', classId, slotId, tutorId, bookingId, data }
 */
async function findMeetingSource(meetingId, meetingStartTime = null) {
  try {
    // First, try to find in Classes collection
    const classData = await Model.Classes.findOne({ 
      'dyteMeeting.meetingId': meetingId 
    });
    
    if (classData) {
      console.log(`✅ Meeting found in CLASSES collection`);
      console.log(`   ClassId: ${classData._id}, TutorId: ${classData.tutorId}`);
      
      // Find matching slot for this class
      const slotId = await findMatchingSlot(classData._id, meetingStartTime, null);
      
      return {
        source: 'class',
        classId: classData._id,
        slotId: slotId,
        tutorId: classData.tutorId,
        bookingId: null,
        data: classData
      };
    }
    
    // If not found in Classes, try Bookings collection
    const bookingData = await Model.Booking.findOne({ 
      'dyteMeeting.meetingId': meetingId 
    });
    
    if (bookingData) {
      console.log(`✅ Meeting found in BOOKINGS collection`);
      console.log(`   BookingId: ${bookingData._id}, TutorId: ${bookingData.tutorId}, ParentId: ${bookingData.parentId}`);
      console.log(`   BookClassId: ${bookingData.bookClassId}`);
      
      // Find matching slot from booking's classSlotIds
      const slotId = await findMatchingSlot(
        bookingData.bookClassId, 
        meetingStartTime, 
        bookingData.classSlotIds
      );
      
      return {
        source: 'booking',
        classId: bookingData.bookClassId || null,  // Use bookClassId, not classId!
        slotId: slotId,
        tutorId: bookingData.tutorId,
        bookingId: bookingData._id,
        data: bookingData
      };
    }
    
    // Not found in either
    console.error(`❌ Meeting ${meetingId} NOT found in Classes or Bookings`);
    return {
      source: null,
      classId: null,
      slotId: null,
      tutorId: null,
      bookingId: null,
      data: null
    };
    
  } catch (error) {
    console.error('Error finding meeting source:', error);
    return {
      source: null,
      classId: null,
      slotId: null,
      tutorId: null,
      bookingId: null,
      data: null
    };
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
    
    // Find the meeting in Classes or Bookings
    console.log(`🔍 Searching for meeting ${meetingId} in Classes and Bookings...`);
    const meetingSource = await findMeetingSource(meetingId, meeting.startedAt);
    
    // 1. Save to MeetingEvents table
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: sessionId,
      roomName: roomName,
      eventType: 'meeting.started',
      meetingStatus: 'LIVE',
      title: title,
      organizedBy: organizedBy,
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Create or Update MeetingSessions table
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      {
        $set: {
          classId: meetingSource.classId,
          slotId: meetingSource.slotId,
          bookingId: meetingSource.bookingId,
          tutorId: meetingSource.tutorId,
          sessionId: sessionId,
          roomName: roomName,
          title: title,
          status: 'LIVE',
          organizedBy: organizedBy,
          createdAt: new Date(meeting.createdAt),
          startedAt: new Date(meeting.startedAt)
        }
      },
      { upsert: true, new: true }
    );
    
    // 3. Update source collection (Classes or Bookings)
    if (meetingSource.source === 'class') {
      await Model.Classes.findOneAndUpdate(
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
    } else if (meetingSource.source === 'booking') {
      await Model.Booking.findOneAndUpdate(
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
    }

    // 4. Update booking details if exists
    await Model.BookingDetails.findOneAndUpdate(
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

    // 5. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Meeting Started',
        message: `Your meeting "${title}" has started`,
        type: 'meeting_started',
        data: { meetingId, title, sessionId, source: meetingSource.source }
      });
    }

    console.log(`✅ Meeting ${meetingId} started successfully (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.started:', error);
    
    // Save error to MeetingEvents
    try {
      await Model.MeetingEvents.create({
        meetingId: payload.meeting?.id,
        eventType: 'meeting.started',
        eventPayload: payload,
        isProcessed: false,
        processingError: error.message
      });
    } catch (e) {
      console.error('Failed to save error to MeetingEvents:', e);
    }
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
    
    // Find the meeting in Classes or Bookings
    console.log(`🔍 Searching for meeting ${meetingId} in Classes and Bookings...`);
    const meetingSource = await findMeetingSource(meetingId, meeting.startedAt);
    
    // 1. Save to MeetingEvents table
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: sessionId,
      eventType: 'meeting.ended',
      meetingStatus: 'ENDED',
      title: title,
      organizedBy: organizedBy,
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      {
        $set: {
          status: 'ENDED',
          endedAt: new Date(endedAt),
          duration: duration,
          endReason: reason,
          organizedBy: organizedBy
        }
      }
    );
    
    // 3. Update source collection (Classes or Bookings)
    if (meetingSource.source === 'class') {
      await Model.Classes.findOneAndUpdate(
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
    } else if (meetingSource.source === 'booking') {
      await Model.Booking.findOneAndUpdate(
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
    }

    // 4. Update booking details if exists
    await Model.BookingDetails.findOneAndUpdate(
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

    // 5. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Meeting Ended',
        message: `Your meeting "${title}" has ended`,
        type: 'meeting_ended',
        data: { meetingId, title, duration, reason, source: meetingSource.source }
      });
    }

    console.log(`✅ Meeting ${meetingId} ended successfully (Source: ${meetingSource.source || 'unknown'}, Duration: ${duration}s)`);
  } catch (error) {
    console.error('❌ Error handling meeting.ended:', error);
    
    // Save error to MeetingEvents
    try {
      await Model.MeetingEvents.create({
        meetingId: payload.meeting?.id,
        eventType: 'meeting.ended',
        eventPayload: payload,
        isProcessed: false,
        processingError: error.message
      });
    } catch (e) {
      console.error('Failed to save error to MeetingEvents:', e);
    }
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
    
    // Find the meeting in Classes or Bookings
    console.log(`🔍 Searching for meeting ${meetingId} in Classes and Bookings...`);
    const meetingSource = await findMeetingSource(meetingId, participant.joinedAt);
    
    // 1. Save to MeetingEvents table
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      eventType: 'meeting.participantJoined',
      meetingStatus: 'LIVE',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Save to MeetingParticipants table
    await Model.MeetingParticipants.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      peerId: participant.peerId,
      userDisplayName: participant.userDisplayName,
      customParticipantId: participant.customParticipantId || '',
      joinedAt: new Date(participant.joinedAt),
      isCurrentlyInMeeting: true
    });

    // 3. Update participant count in MeetingSessions
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $inc: { totalParticipants: 1 },
        $push: { participantList: participantData }
      }
    );
    
    // 4. Update participant count in source (Classes or Bookings)
    if (meetingSource.source === 'class') {
      await Model.Classes.findOneAndUpdate(
        { 'dyteMeeting.meetingId': meetingId },
        { 
          $inc: { 'dyteMeeting.participantCount': 1 },
          $push: { 'dyteMeeting.participants': participantData }
        }
      );
    } else if (meetingSource.source === 'booking') {
      await Model.Booking.findOneAndUpdate(
        { 'dyteMeeting.meetingId': meetingId },
        { 
          $inc: { 'dyteMeeting.participantCount': 1 },
          $push: { 'dyteMeeting.participants': participantData }
        }
      );
    }

    // 5. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Participant Joined',
        message: `${participant.userDisplayName} joined the meeting`,
        type: 'participant_joined',
        data: { meetingId, participant: participantData, source: meetingSource.source }
      });
    }

    console.log(`✅ Participant ${participant.userDisplayName} joined meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.participantJoined:', error);
    
    // Save error to MeetingEvents
    try {
      await Model.MeetingEvents.create({
        meetingId: payload.meeting?.id,
        eventType: 'meeting.participantJoined',
        eventPayload: payload,
        isProcessed: false,
        processingError: error.message
      });
    } catch (e) {
      console.error('Failed to save error to MeetingEvents:', e);
    }
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
    
    // Calculate duration
    const duration = participant.leftAt && participant.joinedAt 
      ? Math.floor((new Date(participant.leftAt) - new Date(participant.joinedAt)) / 1000)
      : 0;
    
    // Find the meeting in Classes or Bookings
    console.log(`🔍 Searching for meeting ${meetingId} in Classes and Bookings...`);
    const meetingSource = await findMeetingSource(meetingId, participant.joinedAt);
    
    // 1. Save to MeetingEvents table
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      eventType: 'meeting.participantLeft',
      meetingStatus: 'LIVE',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingParticipants table
    await Model.MeetingParticipants.findOneAndUpdate(
      { 
        meetingId: meetingId,
        peerId: participant.peerId,
        isCurrentlyInMeeting: true
      },
      {
        $set: {
          leftAt: new Date(participant.leftAt),
          duration: duration,
          isCurrentlyInMeeting: false
        }
      }
    );
    
    // 3. Update participant count in source (Classes or Bookings)
    if (meetingSource.source === 'class') {
      await Model.Classes.findOneAndUpdate(
        { 'dyteMeeting.meetingId': meetingId },
        { 
          $inc: { 'dyteMeeting.participantCount': -1 },
          $pull: { 'dyteMeeting.participants': { peerId: participant.peerId } }
        }
      );
    } else if (meetingSource.source === 'booking') {
      await Model.Booking.findOneAndUpdate(
        { 'dyteMeeting.meetingId': meetingId },
        { 
          $inc: { 'dyteMeeting.participantCount': -1 },
          $pull: { 'dyteMeeting.participants': { peerId: participant.peerId } }
        }
      );
    }

    // 4. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Participant Left',
        message: `${participant.userDisplayName} left the meeting`,
        type: 'participant_left',
        data: { meetingId, participant: participantData, duration, source: meetingSource.source }
      });
    }

    console.log(`✅ Participant ${participant.userDisplayName} left meeting ${meetingId} (Duration: ${duration}s, Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.participantLeft:', error);
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
    
    // Find the meeting in Classes or Bookings
    const meetingSource = await findMeetingSource(meetingId, recording.startedTime);
    
    // 1. Save to MeetingEvents table (audit log)
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      eventType: 'recording.statusUpdate',
      meetingStatus: meeting.status || 'LIVE',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table with recording info
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $set: { 
          'recording.id': recording.id,
          'recording.status': recording.status,
          'recording.startedTime': new Date(recording.startedTime),
          'recording.outputFileName': recording.outputFileName
        } 
      }
    );

    // 3. Send notification when recording is uploaded
    if (recording.status === 'UPLOADED' && meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Recording Available',
        message: `Recording for your meeting is now available`,
        type: 'recording_uploaded',
        data: { meetingId, recording: recordingData, source: meetingSource.source }
      });
    }

    console.log(`✅ Recording ${recording.status} for meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling recording.statusUpdate:', error);
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
    
    // Find the meeting in Classes or Bookings
    const meetingSource = await findMeetingSource(meetingId);
    
    // 1. Save to MeetingEvents table (audit log)
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: sessionId,
      eventType: 'meeting.chatSynced',
      meetingStatus: 'ENDED',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table with chat info
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $set: { 
          'chat.downloadUrl': chatDownloadUrl,
          'chat.downloadUrlExpiry': new Date(chatDownloadUrlExpiry),
          'chat.syncedAt': new Date()
        } 
      }
    );

    console.log(`✅ Chat synced for meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.chatSynced:', error);
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
    
    // Find the meeting in Classes or Bookings
    const meetingSource = await findMeetingSource(meetingId);
    
    // 1. Save to MeetingEvents table (audit log)
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      eventType: 'meeting.transcript',
      meetingStatus: 'ENDED',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table with transcript info
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $set: { 
          'transcript.downloadUrl': transcriptDownloadUrl,
          'transcript.downloadUrlExpiry': new Date(transcriptDownloadUrlExpiry),
          'transcript.availableAt': new Date()
        } 
      }
    );

    // 3. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Transcript Available',
        message: `Transcript for your meeting is now available`,
        type: 'transcript_available',
        data: { meetingId, transcriptDownloadUrl, source: meetingSource.source }
      });
    }

    console.log(`✅ Transcript available for meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.transcript:', error);
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
    
    // Find the meeting in Classes or Bookings
    const meetingSource = await findMeetingSource(meetingId);
    
    // 1. Save to MeetingEvents table (audit log)
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      sessionId: meeting.sessionId,
      eventType: 'meeting.summary',
      meetingStatus: 'ENDED',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table with summary info
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $set: { 
          'summary.downloadUrl': summaryDownloadUrl,
          'summary.downloadUrlExpiry': new Date(summaryDownloadUrlExpiry),
          'summary.availableAt': new Date()
        } 
      }
    );

    // 3. Send notification to tutor
    if (meetingSource.tutorId) {
      process.emit('newNotification', {
        userId: meetingSource.tutorId,
        title: 'Summary Available',
        message: `Summary for your meeting is now available`,
        type: 'summary_available',
        data: { meetingId, summaryDownloadUrl, source: meetingSource.source }
      });
    }

    console.log(`✅ Summary available for meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling meeting.summary:', error);
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
    
    // Find the meeting in Classes or Bookings
    const meetingSource = await findMeetingSource(meetingId);
    
    // 1. Save to MeetingEvents table (audit log)
    await Model.MeetingEvents.create({
      classId: meetingSource.classId,
      slotId: meetingSource.slotId,
      bookingId: meetingSource.bookingId,
      tutorId: meetingSource.tutorId,
      meetingId: meetingId,
      eventType: 'livestreaming.statusUpdate',
      meetingStatus: 'LIVE',
      eventPayload: payload,
      isProcessed: true
    });

    // 2. Update MeetingSessions table with livestream info
    await Model.MeetingSessions.findOneAndUpdate(
      { meetingId: meetingId },
      { 
        $set: { 
          'livestream.streamId': streamId,
          'livestream.status': status,
          'livestream.updatedAt': new Date()
        } 
      }
    );

    console.log(`✅ Livestream ${status} for meeting ${meetingId} (Source: ${meetingSource.source || 'unknown'})`);
  } catch (error) {
    console.error('❌ Error handling livestreaming.statusUpdate:', error);
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

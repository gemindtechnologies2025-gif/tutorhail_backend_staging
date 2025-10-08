const Model = require('../../../models');

/**
 * Get chat data for a specific class and slot
 * GET /api/v1/meeting/chat/:classId/:slotId
 */
module.exports.getChatByClassSlot = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // Find meeting session for this class and slot
    const meetingSession = await Model.MeetingSessions.findOne({
      classId: classId,
      slotId: slotId,
      isDeleted: false
    }).sort({ startedAt: -1 }); // Get most recent if multiple

    if (!meetingSession) {
      return res.error(404, 'No meeting found for this class and slot');
    }

    // Check if chat data exists
    if (!meetingSession.chat || !meetingSession.chat.downloadUrl) {
      return res.error(404, 'Chat data not available for this meeting');
    }

    // Check if URL is expired
    const now = new Date();
    const isExpired = meetingSession.chat.downloadUrlExpiry && 
                     new Date(meetingSession.chat.downloadUrlExpiry) < now;

    return res.success({
      message: 'Chat data retrieved successfully',
      data: {
        meetingId: meetingSession.meetingId,
        classId: meetingSession.classId,
        slotId: meetingSession.slotId,
        sessionId: meetingSession.sessionId,
        title: meetingSession.title,
        chat: {
          downloadUrl: meetingSession.chat.downloadUrl,
          downloadUrlExpiry: meetingSession.chat.downloadUrlExpiry,
          syncedAt: meetingSession.chat.syncedAt,
          isExpired: isExpired
        },
        meetingInfo: {
          startedAt: meetingSession.startedAt,
          endedAt: meetingSession.endedAt,
          duration: meetingSession.duration,
          status: meetingSession.status
        }
      }
    });

  } catch (error) {
    console.error('Error fetching chat data:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Get complete meeting session data (chat, recording, transcript, etc.)
 * GET /api/v1/meeting/session/:classId/:slotId
 */
module.exports.getSessionByClassSlot = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // Find meeting session with all data
    const meetingSession = await Model.MeetingSessions.findOne({
      classId: classId,
      slotId: slotId,
      isDeleted: false
    })
    .populate('classId', 'topic description tutorId')
    .populate('tutorId', 'firstName lastName email')
    .sort({ startedAt: -1 });

    if (!meetingSession) {
      return res.error(404, 'No meeting session found for this class and slot');
    }

    // Check expiry for downloadable content
    const now = new Date();
    const chatExpired = meetingSession.chat?.downloadUrlExpiry && 
                       new Date(meetingSession.chat.downloadUrlExpiry) < now;
    const transcriptExpired = meetingSession.transcript?.downloadUrlExpiry && 
                             new Date(meetingSession.transcript.downloadUrlExpiry) < now;
    const summaryExpired = meetingSession.summary?.downloadUrlExpiry && 
                          new Date(meetingSession.summary.downloadUrlExpiry) < now;

    return res.success({
      message: 'Meeting session retrieved successfully',
      data: {
        meetingId: meetingSession.meetingId,
        sessionId: meetingSession.sessionId,
        classId: meetingSession.classId,
        slotId: meetingSession.slotId,
        tutorId: meetingSession.tutorId,
        title: meetingSession.title,
        status: meetingSession.status,
        
        // Timing
        startedAt: meetingSession.startedAt,
        endedAt: meetingSession.endedAt,
        duration: meetingSession.duration,
        endReason: meetingSession.endReason,
        
        // Participants
        totalParticipants: meetingSession.totalParticipants,
        maxConcurrentParticipants: meetingSession.maxConcurrentParticipants,
        participantList: meetingSession.participantList,
        
        // Recording
        recording: meetingSession.recording ? {
          ...meetingSession.recording,
          isAvailable: meetingSession.recording.status === 'UPLOADED'
        } : null,
        
        // Chat
        chat: meetingSession.chat?.downloadUrl ? {
          downloadUrl: meetingSession.chat.downloadUrl,
          downloadUrlExpiry: meetingSession.chat.downloadUrlExpiry,
          syncedAt: meetingSession.chat.syncedAt,
          isExpired: chatExpired
        } : null,
        
        // Transcript
        transcript: meetingSession.transcript?.downloadUrl ? {
          downloadUrl: meetingSession.transcript.downloadUrl,
          downloadUrlExpiry: meetingSession.transcript.downloadUrlExpiry,
          availableAt: meetingSession.transcript.availableAt,
          isExpired: transcriptExpired
        } : null,
        
        // Summary
        summary: meetingSession.summary?.downloadUrl ? {
          downloadUrl: meetingSession.summary.downloadUrl,
          downloadUrlExpiry: meetingSession.summary.downloadUrlExpiry,
          availableAt: meetingSession.summary.availableAt,
          isExpired: summaryExpired
        } : null,
        
        // Livestream
        livestream: meetingSession.livestream?.streamId ? {
          streamId: meetingSession.livestream.streamId,
          status: meetingSession.livestream.status,
          updatedAt: meetingSession.livestream.updatedAt
        } : null
      }
    });

  } catch (error) {
    console.error('Error fetching meeting session:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Get participants for a specific class and slot
 * GET /api/v1/meeting/participants/:classId/:slotId
 */
module.exports.getParticipantsByClassSlot = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // Find meeting session to get meetingId
    const meetingSession = await Model.MeetingSessions.findOne({
      classId: classId,
      slotId: slotId,
      isDeleted: false
    }).sort({ startedAt: -1 });

    if (!meetingSession) {
      return res.error(404, 'No meeting found for this class and slot');
    }

    // Get all participants for this meeting
    const participants = await Model.MeetingParticipants.find({
      meetingId: meetingSession.meetingId,
      isDeleted: false
    })
    .populate('userId', 'firstName lastName email profilePic')
    .sort({ joinedAt: 1 });

    // Calculate statistics
    const stats = {
      totalParticipants: participants.length,
      currentlyInMeeting: participants.filter(p => p.isCurrentlyInMeeting).length,
      averageDuration: participants.reduce((sum, p) => sum + (p.duration || 0), 0) / participants.length || 0
    };

    return res.success({
      message: 'Participants retrieved successfully',
      data: {
        meetingId: meetingSession.meetingId,
        classId: classId,
        slotId: slotId,
        title: meetingSession.title,
        statistics: stats,
        participants: participants.map(p => ({
          peerId: p.peerId,
          userId: p.userId,
          userDisplayName: p.userDisplayName,
          customParticipantId: p.customParticipantId,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.duration,
          isCurrentlyInMeeting: p.isCurrentlyInMeeting,
          deviceInfo: p.deviceInfo,
          cameraEnabled: p.cameraEnabled,
          microphoneEnabled: p.microphoneEnabled,
          screenShareEnabled: p.screenShareEnabled
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching participants:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Get meeting events/history for a specific class and slot
 * GET /api/v1/meeting/events/:classId/:slotId
 */
module.exports.getEventsByClassSlot = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;
    const { eventType } = req.query; // Optional filter by event type

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // Build query
    const query = {
      classId: classId,
      slotId: slotId
    };

    if (eventType) {
      query.eventType = eventType;
    }

    // Get events
    const events = await Model.MeetingEvents.find(query)
      .sort({ createdAt: 1 }); // Chronological order

    // Group by event type
    const eventsByType = events.reduce((acc, event) => {
      if (!acc[event.eventType]) {
        acc[event.eventType] = [];
      }
      acc[event.eventType].push(event);
      return acc;
    }, {});

    return res.success({
      message: 'Meeting events retrieved successfully',
      data: {
        classId: classId,
        slotId: slotId,
        totalEvents: events.length,
        eventsByType: eventsByType,
        timeline: events.map(e => ({
          eventType: e.eventType,
          meetingStatus: e.meetingStatus,
          timestamp: e.createdAt,
          isProcessed: e.isProcessed,
          processingError: e.processingError,
          title: e.title,
          organizedBy: e.organizedBy
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching meeting events:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Get recording data for a specific class and slot
 * GET /api/v1/meeting/recording/:classId/:slotId
 */
module.exports.getRecordingByClassSlot = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // Find meeting session
    const meetingSession = await Model.MeetingSessions.findOne({
      classId: classId,
      slotId: slotId,
      isDeleted: false
    }).sort({ startedAt: -1 });

    if (!meetingSession) {
      return res.error(404, 'No meeting found for this class and slot');
    }

    // Check if recording exists
    if (!meetingSession.recording || !meetingSession.recording.id) {
      return res.error(404, 'No recording available for this meeting');
    }

    return res.success({
      message: 'Recording data retrieved successfully',
      data: {
        meetingId: meetingSession.meetingId,
        classId: meetingSession.classId,
        slotId: meetingSession.slotId,
        title: meetingSession.title,
        recording: {
          id: meetingSession.recording.id,
          status: meetingSession.recording.status,
          downloadUrl: meetingSession.recording.downloadUrl,
          startedTime: meetingSession.recording.startedTime,
          duration: meetingSession.recording.duration,
          size: meetingSession.recording.size,
          outputFileName: meetingSession.recording.outputFileName,
          isAvailable: meetingSession.recording.status === 'UPLOADED'
        },
        meetingInfo: {
          startedAt: meetingSession.startedAt,
          endedAt: meetingSession.endedAt,
          duration: meetingSession.duration
        }
      }
    });

  } catch (error) {
    console.error('Error fetching recording data:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Get all meetings for a class (all slots)
 * GET /api/v1/meeting/class/:classId
 */
module.exports.getAllMeetingsByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;

    // Validate parameters
    if (!classId) {
      return res.error(400, 'classId is required');
    }

    // Find all meeting sessions for this class
    const meetingSessions = await Model.MeetingSessions.find({
      classId: classId,
      isDeleted: false
    })
    .populate('slotId', 'date startTime endTime')
    .sort({ startedAt: -1 });

    if (!meetingSessions || meetingSessions.length === 0) {
      return res.error(404, 'No meetings found for this class');
    }

    return res.success({
      message: 'All meetings retrieved successfully',
      data: {
        classId: classId,
        totalMeetings: meetingSessions.length,
        meetings: meetingSessions.map(session => ({
          meetingId: session.meetingId,
          slotId: session.slotId,
          slotInfo: session.slotId ? {
            date: session.slotId.date,
            startTime: session.slotId.startTime,
            endTime: session.slotId.endTime
          } : null,
          title: session.title,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          duration: session.duration,
          totalParticipants: session.totalParticipants,
          hasRecording: session.recording?.status === 'UPLOADED',
          hasChat: !!session.chat?.downloadUrl,
          hasTranscript: !!session.transcript?.downloadUrl,
          hasSummary: !!session.summary?.downloadUrl
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching class meetings:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};


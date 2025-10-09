const Model = require('../../../models');
const axios = require('axios');

/**
 * Get chat analytics for a specific class and slot
 * Downloads chat, processes messages, and calculates interaction rate
 * GET /api/v1/Admin/meeting/chat-analytics/:classId/:slotId
 */
module.exports.getChatAnalytics = async (req, res, next) => {
  try {
    const { classId, slotId } = req.params;

    // Validate parameters
    if (!classId || !slotId) {
      return res.error(400, 'classId and slotId are required');
    }

    // 1. Find meeting session
    const meetingSession = await Model.MeetingSessions.findOne({
      classId: classId,
      slotId: slotId,
      isDeleted: { $ne: true }
    }).sort({ startedAt: -1 });

    if (!meetingSession) {
      return res.error(404, 'No meeting found for this class and slot');
    }

    // 2. Check if chat exists
    if (!meetingSession.chat || !meetingSession.chat.downloadUrl) {
      return res.error(404, 'Chat data not available for this meeting');
    }

    // 3. Check if chat URL is expired
    const now = new Date();
    const isExpired = meetingSession.chat.downloadUrlExpiry && 
                     new Date(meetingSession.chat.downloadUrlExpiry) < now;

    if (isExpired) {
      return res.error(410, 'Chat download URL has expired');
    }

    // 4. Get all participants to count total students (exclude tutor)
    const allParticipants = await Model.MeetingParticipants.find({
      meetingId: meetingSession.meetingId,
      isDeleted: { $ne: true }
    }).populate('userId', 'firstName lastName email role');

    // Filter out tutor
    const learnerParticipants = allParticipants.filter(p => {
      return p.userId?._id?.toString() !== meetingSession.tutorId?.toString();
    });

    // 5. Download and process chat
    const chatAnalytics = await downloadAndProcessChat(
      meetingSession.chat.downloadUrl,
      meetingSession.tutorId,
      learnerParticipants.length
    );

    // 6. Return chat analytics
    return res.success({
      message: 'Chat analytics retrieved successfully',
      data: {
        meetingInfo: {
          meetingId: meetingSession.meetingId,
          classId: classId,
          slotId: slotId,
          title: meetingSession.title,
          startedAt: meetingSession.startedAt,
          endedAt: meetingSession.endedAt
        },
        
        chatData: {
          messages: chatAnalytics.messages,
          totalMessages: chatAnalytics.totalMessages,
          tutorMessages: chatAnalytics.tutorMessages,
          studentMessages: chatAnalytics.studentMessages
        },
        
        interactionMetrics: {
          studentsWhoMessaged: chatAnalytics.studentsWhoMessaged,
          totalStudentsInMeeting: learnerParticipants.length,
          interactionRate: chatAnalytics.interactionRate,
          interactionRateFormatted: `${chatAnalytics.interactionRate} messages per student`,
          participationPercentage: learnerParticipants.length > 0 
            ? ((chatAnalytics.studentsWhoMessaged / learnerParticipants.length) * 100).toFixed(1)
            : 0
        },
        
        downloadInfo: {
          downloadUrl: meetingSession.chat.downloadUrl,
          downloadUrlExpiry: meetingSession.chat.downloadUrlExpiry,
          syncedAt: meetingSession.chat.syncedAt,
          isExpired: isExpired
        }
      }
    });

  } catch (error) {
    console.error('Error fetching chat analytics:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Download and process chat from Dyte
 */
async function downloadAndProcessChat(downloadUrl, tutorId, totalStudents) {
  try {
    console.log('📥 Downloading chat from Dyte...');
    
    // Download chat file from Dyte
    const response = await axios.get(downloadUrl, {
      timeout: 15000,
      validateStatus: (status) => status === 200
    });

    const chatData = response.data;
    console.log('✅ Chat downloaded successfully');
    
    // Parse chat messages (format depends on Dyte's chat export format)
    let messages = [];
    
    // Handle different possible chat formats
    if (Array.isArray(chatData)) {
      messages = chatData;
    } else if (chatData.messages && Array.isArray(chatData.messages)) {
      messages = chatData.messages;
    } else if (chatData.data && Array.isArray(chatData.data)) {
      messages = chatData.data;
    }

    console.log(`📝 Processing ${messages.length} messages...`);

    // Process messages and calculate metrics
    const processedMessages = [];
    const studentMessageCount = new Map(); // Track messages per student
    let tutorMessageCount = 0;
    let studentMessageTotal = 0;
    
    for (const msg of messages) {
      // Extract message fields (handle different formats)
      const userId = msg.userId || msg.user_id || msg.senderId || msg.sender_id;
      const userName = msg.userName || msg.user_name || msg.displayName || msg.name || msg.sender_name || 'Unknown';
      const messageText = msg.message || msg.text || msg.body || msg.content || '';
      const timestamp = msg.timestamp || msg.time || msg.createdAt || msg.created_at;
      
      // Determine if tutor or learner
      const isTutor = userId?.toString() === tutorId?.toString();
      const userType = isTutor ? 'tutor' : 'learner';
      
      processedMessages.push({
        userType: userType,
        userName: userName,
        message: messageText,
        timestamp: timestamp
      });
      
      // Count messages
      if (isTutor) {
        tutorMessageCount++;
      } else {
        studentMessageTotal++;
        // Count messages per student
        if (userId) {
          studentMessageCount.set(userId, (studentMessageCount.get(userId) || 0) + 1);
        }
      }
    }
    
    // Calculate interaction rate
    const studentsWhoMessaged = studentMessageCount.size;
    const interactionRate = studentsWhoMessaged > 0 
      ? (studentMessageTotal / studentsWhoMessaged).toFixed(1)
      : 0;

    console.log(`✅ Processed: ${processedMessages.length} messages, ${studentsWhoMessaged} students messaged`);

    return {
      messages: processedMessages,
      totalMessages: processedMessages.length,
      tutorMessages: tutorMessageCount,
      studentMessages: studentMessageTotal,
      studentsWhoMessaged: studentsWhoMessaged,
      interactionRate: parseFloat(interactionRate)
    };

  } catch (error) {
    console.error('❌ Error downloading/parsing chat:', error.message);
    
    // Return empty data structure if chat download fails
    return {
      messages: [],
      totalMessages: 0,
      tutorMessages: 0,
      studentMessages: 0,
      studentsWhoMessaged: 0,
      interactionRate: 0,
      error: `Failed to fetch chat: ${error.message}`
    };
  }
}


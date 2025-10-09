const Model = require('../../../models');

/**
 * Get comprehensive meeting analytics for a class and slot
 * GET /api/v1/webhook/meeting/analytics/:classId/:slotId
 */
module.exports.getMeetingAnalytics = async (req, res, next) => {
  try {
    console.log('🔥 UPDATED CODE RUNNING - Meeting Analytics API called');
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

    // 2. Get all participants (excluding tutor)
    const allParticipants = await Model.MeetingParticipants.find({
      meetingId: meetingSession.meetingId,
      isDeleted: { $ne: true }
    }).populate('userId', 'firstName lastName email role');

    // Filter out tutor and merge duplicate participants (same person rejoining)
    const participantMap = new Map();
    
    for (const p of allParticipants) {
      // Skip tutor
      if (p.userId?._id?.toString() === meetingSession.tutorId?.toString()) {
        continue;
      }
      
      // Use userId or customParticipantId as unique key
      const uniqueKey = p.userId?._id?.toString() || p.customParticipantId || p.userDisplayName;
      
      if (participantMap.has(uniqueKey)) {
        // Participant already exists (rejoined) - merge data
        const existing = participantMap.get(uniqueKey);
        
        // Keep earliest join time
        if (p.joinedAt < existing.joinedAt) {
          existing.joinedAt = p.joinedAt;
        }
        
        // Keep latest left time
        if (p.leftAt && (!existing.leftAt || p.leftAt > existing.leftAt)) {
          existing.leftAt = p.leftAt;
        }
        
        // Add durations together
        existing.duration = (existing.duration || 0) + (p.duration || 0);
        
      } else {
        // New participant
        participantMap.set(uniqueKey, {
          userId: p.userId,
          userDisplayName: p.userDisplayName,
          customParticipantId: p.customParticipantId,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.duration || 0,
          peerId: p.peerId
        });
      }
    }
    
    // Convert map to array
    const learnerParticipants = Array.from(participantMap.values());
    
    console.log(`✅ Processed participants: ${learnerParticipants.length} unique learners (tutor excluded)`);
    console.log(`   Total raw participants from DB: ${allParticipants.length}`);

    // 3. Get enrolled students count - Match Admin API logic
    const constants = require('../../../common/constants');
    const enrolledCount = await Model.Booking.countDocuments({
      bookType: constants.BOOK_TYPE.CLASS,
      bookClassId: classId
      // Note: Not filtering by slotId or bookingStatus, matching Admin API
    });
    
    console.log(`✅ Enrolled students found: ${enrolledCount}`);

    // 4. Calculate Attendance Rate
    const participantCount = learnerParticipants.length;
    
    // Add +1 for tutor to get total expected participants
    const totalExpectedParticipants = enrolledCount + 1;
    console.log(`✅ Total expected participants (enrolled + 1 tutor): ${totalExpectedParticipants}`);
    
    const attendanceRate = totalExpectedParticipants > 0 
      ? ((participantCount / totalExpectedParticipants) * 100).toFixed(2)
      : 0;

    // 5. Calculate Average Watch Time
    const avgWatchTime = calculateAvgWatchTime(learnerParticipants);

    // 6. Calculate Stay to End Rate
    const stayToEndMetrics = calculateStayToEndRate(
      learnerParticipants,
      meetingSession.endedAt
    );

    // 7. Calculate On-Time Rate
    const onTimeRate = calculateOnTimeRate(
      learnerParticipants,
      meetingSession.startedAt
    );

    // 8. Calculate Drop-off Rate
    const dropOffRate = (100 - parseFloat(stayToEndMetrics.stayToEndRate)).toFixed(2);

    // Return comprehensive analytics
    return res.success({
      message: 'Meeting analytics retrieved successfully',
      data: {
        meetingInfo: {
          meetingId: meetingSession.meetingId,
          classId: classId,
          slotId: slotId,
          title: meetingSession.title,
          startedAt: meetingSession.startedAt,
          endedAt: meetingSession.endedAt,
          duration: meetingSession.duration,
          status: meetingSession.status
        },
        
        // Attendance Metrics
        attendance: {
          enrolledStudents: enrolledCount,
          totalExpectedParticipants: totalExpectedParticipants,
          participantCount: participantCount,
          attendanceRate: parseFloat(attendanceRate),
          attendanceRateFormatted: `${attendanceRate}%`
        },
        
        // Watch Time Metrics
        watchTime: {
          averageWatchTimeMinutes: avgWatchTime.avgMinutes,
          averageWatchTimeFormatted: avgWatchTime.formatted,
          totalWatchTimeMinutes: avgWatchTime.totalMinutes,
          participants: avgWatchTime.participantCount
        },
        
        // Stay to End Metrics
        engagement: {
          stayToEndRate: parseFloat(stayToEndMetrics.stayToEndRate),
          stayToEndRateFormatted: `${stayToEndMetrics.stayToEndRate}%`,
          stayedTillEnd: stayToEndMetrics.stayedCount,
          leftEarly: stayToEndMetrics.leftEarlyCount,
          
          dropOffRate: parseFloat(dropOffRate),
          dropOffRateFormatted: `${dropOffRate}%`
        },
        
        // On-Time Metrics
        punctuality: {
          onTimeRate: parseFloat(onTimeRate.onTimeRate),
          onTimeRateFormatted: `${onTimeRate.onTimeRate}%`,
          onTimeParticipants: onTimeRate.onTimeCount,
          lateParticipants: onTimeRate.lateCount
        },
        
        // Participant Details
        participantDetails: learnerParticipants.map(p => ({
          name: p.userDisplayName,
          userId: p.userId?._id,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          durationMinutes: p.duration ? Math.floor(p.duration / 60) : 0,
          wasOnTime: isOnTime(p.joinedAt, meetingSession.startedAt),
          stayedTillEnd: stayedTillEnd(p.leftAt, meetingSession.endedAt)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching meeting analytics:', error);
    return res.error(500, error.message || 'Internal server error');
  }
};

/**
 * Calculate average watch time in minutes
 */
function calculateAvgWatchTime(participants) {
  let totalSeconds = 0;
  let validParticipants = 0;

  for (const participant of participants) {
    if (participant.duration && participant.duration > 0) {
      totalSeconds += participant.duration;
      validParticipants++;
    }
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const avgMinutes = validParticipants > 0 
    ? (totalMinutes / validParticipants).toFixed(1)
    : 0;

  const hours = Math.floor(parseFloat(avgMinutes) / 60);
  const mins = Math.floor(parseFloat(avgMinutes) % 60);
  const formatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return {
    avgMinutes: parseFloat(avgMinutes),
    totalMinutes: totalMinutes,
    participantCount: validParticipants,
    formatted: formatted
  };
}

/**
 * Calculate stay to end rate
 */
function calculateStayToEndRate(participants, meetingEndTime) {
  if (!meetingEndTime || participants.length === 0) {
    return {
      stayToEndRate: '0.00',
      stayedCount: 0,
      leftEarlyCount: 0
    };
  }

  const endTime = new Date(meetingEndTime);
  let stayedCount = 0;
  let leftEarlyCount = 0;

  for (const participant of participants) {
    if (stayedTillEnd(participant.leftAt, meetingEndTime)) {
      stayedCount++;
    } else {
      leftEarlyCount++;
    }
  }

  const stayToEndRate = participants.length > 0
    ? ((stayedCount / participants.length) * 100).toFixed(2)
    : '0.00';

  return {
    stayToEndRate: stayToEndRate,
    stayedCount: stayedCount,
    leftEarlyCount: leftEarlyCount
  };
}

/**
 * Check if participant stayed till end (left within 5 min of meeting end)
 */
function stayedTillEnd(leftAt, meetingEndTime) {
  if (!leftAt || !meetingEndTime) {
    return false;
  }

  const leftTime = new Date(leftAt);
  const endTime = new Date(meetingEndTime);
  const diffMinutes = Math.abs((endTime - leftTime) / (1000 * 60));

  // Stayed if left within 5 minutes of meeting end
  return diffMinutes <= 5;
}

/**
 * Calculate on-time rate (joined within 5 min of meeting start)
 */
function calculateOnTimeRate(participants, meetingStartTime) {
  if (!meetingStartTime || participants.length === 0) {
    return {
      onTimeRate: '0.00',
      onTimeCount: 0,
      lateCount: 0
    };
  }

  let onTimeCount = 0;
  let lateCount = 0;

  for (const participant of participants) {
    if (isOnTime(participant.joinedAt, meetingStartTime)) {
      onTimeCount++;
    } else {
      lateCount++;
    }
  }

  const onTimeRate = participants.length > 0
    ? ((onTimeCount / participants.length) * 100).toFixed(2)
    : '0.00';

  return {
    onTimeRate: onTimeRate,
    onTimeCount: onTimeCount,
    lateCount: lateCount
  };
}

/**
 * Check if participant joined on time (within 5 min of meeting start)
 */
function isOnTime(joinedAt, meetingStartTime) {
  if (!joinedAt || !meetingStartTime) {
    return false;
  }

  const joinTime = new Date(joinedAt);
  const startTime = new Date(meetingStartTime);
  const diffMinutes = (joinTime - startTime) / (1000 * 60);

  // On-time if joined within 5 minutes after meeting start
  // Allow up to 5 minutes late
  return diffMinutes >= -5 && diffMinutes <= 5;
}


const Model = require('../../../models');

/**
 * Get comprehensive meeting analytics for a class and slot
 * GET /api/v1/Admin/meeting/analytics/:classId/:slotId
 */
module.exports.getMeetingAnalytics = async (req, res, next) => {
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

    // 2. Get all participants (excluding tutor)
    const allParticipants = await Model.MeetingParticipants.find({
      meetingId: meetingSession.meetingId,
      isDeleted: { $ne: true }
    }).populate('userId', 'firstName lastName email role');

    // Filter out tutor participants (role might be in userId or check if it's the class tutor)
    const learnerParticipants = allParticipants.filter(p => {
      // Check if participant is not the tutor
      return p.userId?._id?.toString() !== meetingSession.tutorId?.toString();
    });

    // 3. Get enrolled students count
    const enrolledCount = await Model.Booking.countDocuments({
      bookClassId: classId,
      classSlotIds: slotId,
      bookingStatus: { $ne: 3 } // Exclude cancelled bookings
    });

    // 4. Calculate Attendance Rate
    const participantCount = learnerParticipants.length;
    const attendanceRate = enrolledCount > 0 
      ? ((participantCount / enrolledCount) * 100).toFixed(2)
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


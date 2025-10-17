const mongoose = require('mongoose');

/**
 * Middleware to track user activity
 * Updates lastActivityAt timestamp whenever user performs actions
 * This helps determine if account is active (used within last 60 days)
 */
module.exports.trackUserActivity = async (req, res, next) => {
  try {
    // Only track if user is authenticated
    if (req.user && req.user._id) {
      // Update lastActivityAt in background (don't block request)
      Model.User.findByIdAndUpdate(
        req.user._id,
        { 
          lastActivityAt: new Date(),
          isActive: true // Mark as active when user performs any action
        },
        { new: false }
      ).exec().catch(err => {
        // Log error but don't fail the request
        console.error('Error tracking user activity:', err);
      });
    }
    next();
  } catch (error) {
    // Don't fail the request if activity tracking fails
    console.error('Activity tracking middleware error:', error);
    next();
  }
};

/**
 * Helper function to identify users inactive for more than specified days
 * @param {Number} days - Number of days (default: 60)
 * @returns {Promise<Array>} - Array of inactive user IDs
 */
module.exports.getInactiveUsers = async (days = 60) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const User = mongoose.model('User');
    const inactiveUsers = await User.find({
      lastActivityAt: { $lt: cutoffDate },
      isDeleted: false,
      isBlocked: false
    }).select('_id name email role lastActivityAt').lean();

    return inactiveUsers;
  } catch (error) {
    console.error('Error fetching inactive users:', error);
    throw error;
  }
};

/**
 * Helper function to mark users as inactive based on last activity
 * @param {Number} days - Number of days (default: 60)
 * @returns {Promise<Object>} - Update result
 */
module.exports.markInactiveUsers = async (days = 60) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const User = mongoose.model('User');
    const result = await User.updateMany(
      {
        lastActivityAt: { $lt: cutoffDate },
        isActive: true,
        isDeleted: false
      },
      {
        $set: { isActive: false }
      }
    );

    console.log(`Marked ${result.modifiedCount} users as inactive (no activity since ${cutoffDate.toISOString()})`);
    return result;
  } catch (error) {
    console.error('Error marking inactive users:', error);
    throw error;
  }
};

/**
 * Helper function to get inactive users count by role
 * @param {Number} days - Number of days (default: 60)
 * @returns {Promise<Object>} - Count of inactive users by role
 */
module.exports.getInactiveUserStats = async (days = 60) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const User = mongoose.model('User');
    const stats = await User.aggregate([
      {
        $match: {
          lastActivityAt: { $lt: cutoffDate },
          isDeleted: false,
          isBlocked: false
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          users: { 
            $push: { 
              id: '$_id', 
              name: '$name', 
              email: '$email',
              lastActivityAt: '$lastActivityAt'
            } 
          }
        }
      }
    ]);

    return stats;
  } catch (error) {
    console.error('Error getting inactive user stats:', error);
    throw error;
  }
};


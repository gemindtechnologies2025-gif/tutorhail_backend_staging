/**
 * Activity Tracking Test & Verification Script
 * 
 * This script helps you verify that the activity tracking system is working correctly.
 * Run this AFTER running the migration script.
 * 
 * Usage: node test_activity_tracking.js
 */

const mongoose = require('mongoose');
const Model = require('./models');
const { getInactiveUsers, markInactiveUsers, getInactiveUserStats } = require('./common/activityTracker');
const constants = require('./common/constants');

require('dotenv').config({ path: '.env.develop' });

// ANSI color codes for pretty output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`)
};

let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0
};

const runTests = async () => {
  try {
    log.section();
    log.title('🧪 ACTIVITY TRACKING SYSTEM - TEST SUITE');
    log.section();

    // Connect to database
    const dbUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorhail';
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    log.success('Connected to database\n');

    // Test 1: Check if migration ran
    await testMigrationCompleted();

    // Test 2: Check User model schema
    await testUserModelSchema();

    // Test 3: Check field population
    await testFieldPopulation();

    // Test 4: Check indexes
    await testIndexes();

    // Test 5: Test activity tracker functions
    await testActivityTrackerFunctions();

    // Test 6: Test inactive user detection
    await testInactiveUserDetection();

    // Test 7: Test cron job configuration
    await testCronJobConfig();

    // Test 8: Simulate activity tracking
    await testActivityUpdate();

    // Print summary
    log.section();
    log.title('📊 TEST SUMMARY');
    log.section();
    console.log(`${colors.green}✅ Passed: ${testResults.passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${testResults.failed}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Warnings: ${testResults.warnings}${colors.reset}\n`);

    if (testResults.failed === 0) {
      log.success('All critical tests passed! System is ready to use. 🎉\n');
    } else {
      log.error('Some tests failed. Please review the errors above.\n');
    }

    // Generate report
    await generateDetailedReport();

    await mongoose.connection.close();
    log.info('Database connection closed.\n');

    process.exit(testResults.failed > 0 ? 1 : 0);

  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

// Test 1: Check if migration completed
const testMigrationCompleted = async () => {
  log.title('\n1️⃣  Testing Migration Completion');
  
  try {
    const totalUsers = await Model.User.countDocuments({});
    const usersWithLastActivity = await Model.User.countDocuments({ 
      lastActivityAt: { $exists: true } 
    });
    const usersWithAvailability = await Model.User.countDocuments({ 
      isAvailableForBooking: { $exists: true } 
    });

    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users with lastActivityAt: ${usersWithLastActivity}`);
    console.log(`   Users with isAvailableForBooking: ${usersWithAvailability}`);

    if (totalUsers === 0) {
      log.warning('No users in database. Migration status cannot be verified.');
      testResults.warnings++;
    } else if (usersWithLastActivity === totalUsers && usersWithAvailability === totalUsers) {
      log.success('Migration completed successfully for all users!');
      testResults.passed++;
    } else {
      log.error(`Migration incomplete! ${totalUsers - usersWithLastActivity} users missing lastActivityAt`);
      log.info('Run: node migrations/migrate_activity_fields.js');
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Migration test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 2: Check User model schema
const testUserModelSchema = async () => {
  log.title('\n2️⃣  Testing User Model Schema');
  
  try {
    const schema = Model.User.schema.paths;
    
    const requiredFields = [
      'isAvailableForBooking',
      'isActive',
      'lastActivityAt',
      'isOnline'
    ];

    let allFieldsPresent = true;
    for (const field of requiredFields) {
      if (schema[field]) {
        log.success(`Field '${field}' exists in schema`);
      } else {
        log.error(`Field '${field}' missing from schema!`);
        allFieldsPresent = false;
      }
    }

    if (allFieldsPresent) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Schema test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 3: Check field population
const testFieldPopulation = async () => {
  log.title('\n3️⃣  Testing Field Population');
  
  try {
    const sampleUser = await Model.User.findOne({}).lean();
    
    if (!sampleUser) {
      log.warning('No users found to test field population');
      testResults.warnings++;
      return;
    }

    console.log(`\n   Sample User (${sampleUser.name || 'Unnamed'}):`);
    console.log(`   - isAvailableForBooking: ${sampleUser.isAvailableForBooking}`);
    console.log(`   - isActive: ${sampleUser.isActive}`);
    console.log(`   - lastActivityAt: ${sampleUser.lastActivityAt}`);
    console.log(`   - isOnline: ${sampleUser.isOnline}`);

    if (sampleUser.lastActivityAt && typeof sampleUser.isAvailableForBooking === 'boolean') {
      log.success('Fields are properly populated!');
      testResults.passed++;
    } else {
      log.error('Some fields are not properly populated!');
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Field population test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 4: Check indexes
const testIndexes = async () => {
  log.title('\n4️⃣  Testing Database Indexes');
  
  try {
    const indexes = await Model.User.collection.getIndexes();
    
    const requiredIndexes = ['lastActivityAt_1', 'isActive_1'];
    let indexesFound = [];
    let indexesMissing = [];

    for (const indexName of requiredIndexes) {
      if (indexes[indexName]) {
        indexesFound.push(indexName);
        log.success(`Index '${indexName}' exists`);
      } else {
        indexesMissing.push(indexName);
        log.warning(`Index '${indexName}' not found (will be created on app start)`);
      }
    }

    if (indexesMissing.length === 0) {
      testResults.passed++;
    } else {
      log.info('Indexes will be created automatically when the app starts');
      testResults.warnings++;
    }
  } catch (error) {
    log.error(`Index test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 5: Test activity tracker functions
const testActivityTrackerFunctions = async () => {
  log.title('\n5️⃣  Testing Activity Tracker Functions');
  
  try {
    // Test getInactiveUsers
    const inactiveUsers = await getInactiveUsers(60);
    log.success(`getInactiveUsers(60) works - Found ${inactiveUsers.length} inactive users`);

    // Test getInactiveUserStats
    const stats = await getInactiveUserStats(60);
    log.success(`getInactiveUserStats(60) works - Found ${stats.length} role groups`);
    
    if (stats.length > 0) {
      console.log('\n   Inactive User Stats:');
      stats.forEach(s => {
        const role = s._id === constants.APP_ROLE.TUTOR ? 'Tutors' : 'Parents';
        console.log(`   - ${role}: ${s.count} inactive users`);
      });
    }

    testResults.passed++;
  } catch (error) {
    log.error(`Activity tracker functions test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 6: Test inactive user detection
const testInactiveUserDetection = async () => {
  log.title('\n6️⃣  Testing Inactive User Detection Logic');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    const usersOlderThan60Days = await Model.User.countDocuments({
      lastActivityAt: { $lt: cutoffDate }
    });

    const usersMarkedInactive = await Model.User.countDocuments({
      isActive: false
    });

    console.log(`   Users with activity > 60 days ago: ${usersOlderThan60Days}`);
    console.log(`   Users marked as inactive: ${usersMarkedInactive}`);

    if (usersOlderThan60Days === 0) {
      log.info('All users are active (within 60 days). Nothing to mark as inactive.');
    } else {
      log.info(`Run cron job to mark ${usersOlderThan60Days} users as inactive`);
    }

    testResults.passed++;
  } catch (error) {
    log.error(`Inactive user detection test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 7: Test cron job configuration
const testCronJobConfig = async () => {
  log.title('\n7️⃣  Testing Cron Job Configuration');
  
  try {
    const cronjobs = require('./cron/cronjobs');
    
    if (cronjobs.checkInactiveUsers) {
      log.success('Cron job checkInactiveUsers is defined');
      
      const cronTime = cronjobs.checkInactiveUsers.cronTime;
      if (cronTime) {
        log.info(`Cron schedule: ${cronTime.source} (Daily at 2 AM)`);
      }
      
      testResults.passed++;
    } else {
      log.error('Cron job checkInactiveUsers not found!');
      testResults.failed++;
    }
  } catch (error) {
    log.error(`Cron job test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Test 8: Simulate activity update
const testActivityUpdate = async () => {
  log.title('\n8️⃣  Testing Activity Update Simulation');
  
  try {
    const testUser = await Model.User.findOne({}).lean();
    
    if (!testUser) {
      log.warning('No users found to test activity update');
      testResults.warnings++;
      return;
    }

    const oldActivityTime = testUser.lastActivityAt;
    
    // Simulate activity update
    await Model.User.findByIdAndUpdate(testUser._id, {
      lastActivityAt: new Date(),
      isActive: true
    });

    const updatedUser = await Model.User.findById(testUser._id).lean();
    
    if (updatedUser.lastActivityAt > oldActivityTime) {
      log.success('Activity update works correctly!');
      testResults.passed++;
    } else {
      log.error('Activity update failed!');
      testResults.failed++;
    }

    // Restore original value
    await Model.User.findByIdAndUpdate(testUser._id, {
      lastActivityAt: oldActivityTime
    });

  } catch (error) {
    log.error(`Activity update test failed: ${error.message}`);
    testResults.failed++;
  }
};

// Generate detailed report
const generateDetailedReport = async () => {
  log.section();
  log.title('📋 DETAILED SYSTEM REPORT');
  log.section();

  try {
    const totalUsers = await Model.User.countDocuments({});
    const tutors = await Model.User.countDocuments({ role: constants.APP_ROLE.TUTOR });
    const parents = await Model.User.countDocuments({ role: constants.APP_ROLE.PARENT });
    
    const activeUsers = await Model.User.countDocuments({ isActive: true });
    const inactiveUsers = await Model.User.countDocuments({ isActive: false });
    
    const availableTutors = await Model.User.countDocuments({ 
      role: constants.APP_ROLE.TUTOR,
      isAvailableForBooking: true 
    });
    
    const onlineUsers = await Model.User.countDocuments({ isOnline: true });

    console.log('\n📊 User Statistics:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   - Tutors: ${tutors}`);
    console.log(`   - Parents: ${parents}`);
    console.log('');
    console.log(`   Active Accounts (60-day): ${activeUsers} (${((activeUsers/totalUsers)*100).toFixed(1)}%)`);
    console.log(`   Inactive Accounts (60-day): ${inactiveUsers} (${((inactiveUsers/totalUsers)*100).toFixed(1)}%)`);
    console.log('');
    console.log(`   Available for Booking (Tutors): ${availableTutors} of ${tutors}`);
    console.log(`   Currently Online: ${onlineUsers}`);

    // Activity distribution
    const activityDistribution = await Model.User.aggregate([
      {
        $project: {
          role: 1,
          daysSinceActivity: {
            $divide: [
              { $subtract: [new Date(), '$lastActivityAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$daysSinceActivity',
          boundaries: [0, 7, 30, 60, 90, 365, Infinity],
          default: 'Unknown',
          output: {
            count: { $sum: 1 },
            users: { $push: '$_id' }
          }
        }
      }
    ]);

    console.log('\n📅 Activity Distribution:');
    const labels = {
      0: 'Last 7 days',
      7: '7-30 days',
      30: '30-60 days',
      60: '60-90 days',
      90: '90-365 days',
      365: '365+ days'
    };
    
    activityDistribution.forEach(bucket => {
      const label = labels[bucket._id] || bucket._id;
      console.log(`   ${label}: ${bucket.count} users`);
    });

    console.log('');

  } catch (error) {
    log.error(`Report generation failed: ${error.message}`);
  }
};

// Run tests
console.log('\n');
runTests();


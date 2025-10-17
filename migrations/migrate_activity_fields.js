/**
 * Migration Script: Activity Tracking Fields
 * 
 * This script migrates existing users to the new activity tracking system:
 * 1. Adds lastActivityAt field (initialized to current date for existing users)
 * 2. Renames isActive to isAvailableForBooking (preserves existing values)
 * 3. Sets new isActive field to true (assumes existing users are active)
 * 
 * Run this ONCE after deploying the model changes.
 * 
 * Usage: node migrations/migrate_activity_fields.js
 */

const mongoose = require('mongoose');
const Model = require('../models');

// Load environment variables from .env.develop
require('dotenv').config({ path: '.env.develop' });

const migrateActivityFields = async () => {
  try {
    console.log('🚀 Starting Activity Fields Migration...\n');

    // Connect to database
    const dbUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorhail';
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database\n');

    // Step 1: Get statistics before migration
    const totalUsers = await Model.User.countDocuments({});
    const usersWithoutLastActivity = await Model.User.countDocuments({ 
      lastActivityAt: { $exists: false } 
    });
    
    console.log('📊 Pre-Migration Statistics:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Users without lastActivityAt: ${usersWithoutLastActivity}`);
    console.log(`   Users to migrate: ${usersWithoutLastActivity}\n`);

    if (usersWithoutLastActivity === 0) {
      console.log('✅ All users already migrated. Nothing to do.\n');
      await mongoose.connection.close();
      return;
    }

    // Step 2: Migrate users in batches to avoid memory issues
    const batchSize = 100;
    let migratedCount = 0;
    let errorCount = 0;

    console.log('🔄 Starting migration in batches of', batchSize, '...\n');

    // Find users that need migration
    const cursor = Model.User.find({ 
      lastActivityAt: { $exists: false } 
    }).cursor();

    let batch = [];
    
    for (let user = await cursor.next(); user != null; user = await cursor.next()) {
      batch.push(user);
      
      if (batch.length >= batchSize) {
        const result = await migrateBatch(batch);
        migratedCount += result.success;
        errorCount += result.errors;
        batch = [];
        
        // Progress indicator
        if (migratedCount % 500 === 0) {
          console.log(`   Processed ${migratedCount} users...`);
        }
      }
    }
    
    // Process remaining users
    if (batch.length > 0) {
      const result = await migrateBatch(batch);
      migratedCount += result.success;
      errorCount += result.errors;
    }

    // Step 3: Verify migration
    const verifyCount = await Model.User.countDocuments({ 
      lastActivityAt: { $exists: true } 
    });

    console.log('\n✅ Migration Complete!\n');
    console.log('📊 Post-Migration Statistics:');
    console.log(`   Users migrated successfully: ${migratedCount}`);
    console.log(`   Errors encountered: ${errorCount}`);
    console.log(`   Users with lastActivityAt: ${verifyCount}`);
    console.log(`   Total users: ${totalUsers}\n`);

    if (verifyCount === totalUsers) {
      console.log('✨ Perfect! All users successfully migrated.\n');
    } else {
      console.log('⚠️  Warning: Some users may not have been migrated. Please check logs.\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed.\n');
    
  } catch (error) {
    console.error('❌ Migration Error:', error);
    process.exit(1);
  }
};

/**
 * Migrate a batch of users
 */
const migrateBatch = async (users) => {
  let success = 0;
  let errors = 0;

  const bulkOps = users.map(user => {
    // Preserve old isActive value for booking availability
    const oldIsActive = user.isActive ?? true;
    
    return {
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            isAvailableForBooking: oldIsActive,  // Preserve booking availability
            isActive: true,                       // Assume existing users are active
            lastActivityAt: user.updatedAt || user.createdAt || new Date() // Use last update or creation date
          }
        }
      }
    };
  });

  try {
    const result = await Model.User.bulkWrite(bulkOps);
    success = result.modifiedCount;
  } catch (error) {
    console.error('Batch migration error:', error.message);
    errors = users.length;
  }

  return { success, errors };
};

/**
 * Rollback function (if needed)
 * WARNING: This will remove the new fields. Use with caution!
 */
const rollback = async () => {
  try {
    console.log('⚠️  ROLLING BACK MIGRATION...\n');
    
    const dbUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorhail';
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const result = await Model.User.updateMany(
      {},
      {
        $unset: { 
          lastActivityAt: "",
          isAvailableForBooking: "" 
        }
      }
    );

    console.log(`✅ Rollback complete. Modified ${result.modifiedCount} users.\n`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Rollback Error:', error);
    process.exit(1);
  }
};

// Check if rollback flag is passed
const args = process.argv.slice(2);
if (args.includes('--rollback')) {
  console.log('\n⚠️  WARNING: This will remove lastActivityAt and isAvailableForBooking fields!\n');
  console.log('Press Ctrl+C within 5 seconds to cancel...\n');
  
  setTimeout(() => {
    rollback();
  }, 5000);
} else {
  // Run migration
  migrateActivityFields();
}

module.exports = { migrateActivityFields, rollback };


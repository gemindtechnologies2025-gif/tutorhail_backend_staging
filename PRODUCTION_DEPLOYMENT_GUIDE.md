# Activity Tracking - Production Deployment Guide

## 🎯 Overview

This guide covers the complete process of deploying the Activity Tracking system to production, including the critical one-time data migration that must be performed.

## 📋 Prerequisites

- ✅ Code committed to git
- ✅ Staging environment tested and working
- ✅ Production server access
- ✅ Database backup capability
- ✅ Application restart capability

---

## 🚀 Step-by-Step Production Deployment

### Step 1: Deploy Code to Production

**Deploy all updated files to production:**

```bash
# On production server
git pull origin main

# Or trigger your deployment pipeline
# (Jenkins, GitHub Actions, etc.)
```

**Files that need to be deployed:**
- `models/User.js` (new fields)
- `common/activityTracker.js` (new file)
- `cron/cronjobs.js` (new cron job)
- `socket/UserSockets.js` (updated socket handler)
- `v1/controller/TutorController/Tutor.js` (updated logout)
- `v1/controller/AdminController/Admin.js` (new endpoints)
- `v1/routes/Admin.js` (new routes)
- `v1/validations/Tutor.js` (updated validation)
- `common/index.js` (export activity tracker)
- `migrations/migrate_activity_fields.js` (migration script)
- `test_activity_tracking.js` (test script)

### Step 2: Verify Environment Variables

**Ensure production `.env` has correct database URI:**

```bash
# Check database connection
node -e "
require('dotenv').config();
console.log('Database URI:', process.env.MONGODB_URL || process.env.MONGODB_URI);
console.log('NODE_ENV:', process.env.NODE_ENV);
"
```

**Expected output:**
```
Database URI: mongodb://your-production-server:27017/tutorhail_production
NODE_ENV: production
```

### Step 3: Create Database Backup (Recommended)

**⚠️ IMPORTANT: Backup before migration**

```bash
# Create backup with timestamp
mongodump --uri="mongodb://your-production-server:27017/tutorhail_production" --out=/backup/before-activity-tracking-$(date +%Y%m%d_%H%M%S)

# Verify backup
ls -la /backup/before-activity-tracking-*
```

### Step 4: Run One-Time Data Migration ⚠️ **CRITICAL**

**This is the most important step - adds new fields to all existing users:**

```bash
# Run migration script
node migrations/migrate_activity_fields.js
```

**Expected Output:**
```
🚀 Starting Activity Fields Migration...

✅ Connected to database

📊 Pre-Migration Statistics:
   Total Users: [Your Production User Count]
   Users without lastActivityAt: [Your Production User Count]
   Users to migrate: [Your Production User Count]

🔄 Starting migration in batches of 100 ...

✅ Migration Complete!

📊 Post-Migration Statistics:
   Users migrated successfully: [Your Production User Count]
   Errors encountered: 0
   Users with lastActivityAt: [Your Production User Count]
   Total users: [Your Production User Count]

✨ Perfect! All users successfully migrated.

✅ Database connection closed.
```

**What this migration does:**
- ✅ Adds `isAvailableForBooking` field (from old `isActive`)
- ✅ Adds `isActive` field (set to `true` for existing users)
- ✅ Adds `lastActivityAt` field (set to `updatedAt` or `createdAt`)
- ✅ Processes users in batches of 100 (safe for large databases)

### Step 5: Verify Migration Success

**Run comprehensive test suite:**

```bash
node test_activity_tracking.js
```

**Expected Output:**
```
🧪 ACTIVITY TRACKING SYSTEM - TEST SUITE
✅ Connected to database

1️⃣  Testing Migration Completion
   Total users: [X]
   Users with lastActivityAt: [X]
   Users with isAvailableForBooking: [X]
✅ Migration completed successfully for all users!

2️⃣  Testing User Model Schema
✅ Field 'isAvailableForBooking' exists in schema
✅ Field 'isActive' exists in schema
✅ Field 'lastActivityAt' exists in schema
✅ Field 'isOnline' exists in schema

3️⃣  Testing Field Population
✅ Fields are properly populated!

4️⃣  Testing Database Indexes
✅ Index 'lastActivityAt_1' exists
✅ Index 'isActive_1' exists

5️⃣  Testing Activity Tracker Functions
✅ getInactiveUsers(60) works - Found X inactive users
✅ getInactiveUserStats(60) works - Found 2 role groups

6️⃣  Testing Inactive User Detection Logic
✅ Test passed

7️⃣  Testing Cron Job Configuration
✅ Cron job checkInactiveUsers is defined

8️⃣  Testing Activity Update Simulation
✅ Activity update works correctly!

📊 TEST SUMMARY
✅ Passed: 8
❌ Failed: 0
⚠️  Warnings: 0

✅ All critical tests passed! System is ready to use. 🎉
```

### Step 6: Add Activity Tracking Middleware

**Add to your production route files:**

```javascript
// In v1/routes/Tutor.js
const { activityTracker } = require('../../common');

router.get('/getProfile', 
  Auth.verify(), 
  activityTracker.trackUserActivity,  // ← ADD THIS
  Controller.TutorController.getProfile
);

router.put('/updateProfile', 
  Auth.verify(), 
  activityTracker.trackUserActivity,  // ← ADD THIS
  Controller.TutorController.updateProfile
);

// Add to other important routes:
// - Login endpoints
// - Booking actions
// - Content creation
// - Search/browse actions
```

**Recommended routes to add activity tracking:**
- `GET /getProfile`
- `PUT /updateProfile`
- `POST /login`
- `POST /createBooking`
- `GET /searchTutors`
- `POST /sendMessage`
- `GET /dashboard`
- `POST /createContent`

### Step 7: Restart Application

**⚠️ CRITICAL: Restart to activate cron job**

```bash
# Option 1: PM2
pm2 restart your-app-name

# Option 2: Systemd
systemctl restart your-app-service

# Option 3: Docker
docker-compose restart

# Option 4: Manual
# Stop: Ctrl+C or kill process
# Start: npm start or node server.js
```

**Look for these logs after restart:**
```
Server started on port [YOUR_PORT]
Connected to database
Agenda Started
Cron job started: checkInactiveUsers
```

### Step 8: Test Production Endpoints

**Test admin endpoints:**

```bash
# Get admin token
curl -X POST "https://your-production-domain.com/api/v1/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'

# Test inactive users endpoint
curl -X GET "https://your-production-domain.com/api/v1/admin/getInactiveUsers?days=60&page=1&limit=5" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "statusCode": 200,
  "message": "Inactive users fetched successfully",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNo": "+1234567890",
        "role": 1,
        "lastActivityAt": "2024-06-15T10:30:00.000Z",
        "isActive": false,
        "createdAt": "2024-01-01T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 5,
      "total": 50,
      "pages": 10
    },
    "inactiveSince": "2024-08-16T00:00:00.000Z"
  }
}
```

**Test inactive user stats:**
```bash
curl -X GET "https://your-production-domain.com/api/v1/admin/getInactiveUserStats?days=60" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📊 Production Checklist

### ✅ Pre-Deployment
- [ ] Code committed to git
- [ ] Code deployed to production
- [ ] Environment variables configured
- [ ] Database backup created (recommended)

### ✅ Migration (ONE TIME ONLY)
- [ ] **Run migration script**: `node migrations/migrate_activity_fields.js`
- [ ] **Verify migration**: `node test_activity_tracking.js`
- [ ] **Check all tests pass**: 8/8 tests

### ✅ Configuration
- [ ] **Activity tracking middleware** added to routes
- [ ] **Application restarted** (to activate cron job)
- [ ] **Cron job scheduled** (runs at 2 AM)

### ✅ Testing
- [ ] **Admin endpoints** working
- [ ] **Socket events** working
- [ ] **Activity tracking** updating `lastActivityAt`
- [ ] **Database queries** performing well

### ✅ Monitoring
- [ ] **Cron job logs** daily
- [ ] **Inactive user counts** tracked
- [ ] **Performance metrics** monitored

---

## ⏰ Cron Job Schedule

**The cron job runs:**
- **Frequency:** Daily at 2:00 AM server time
- **Schedule:** `'0 2 * * *'`
- **Action:** Marks users inactive if no activity in last 60 days

**To verify cron job is running:**
```bash
# Check logs for cron job messages
tail -f your-app.log | grep -i "cron\|inactive"

# Or check manually
node -e "
const cronjobs = require('./cron/cronjobs');
console.log('Cron job defined:', !!cronjobs.checkInactiveUsers);
console.log('Cron schedule:', cronjobs.checkInactiveUsers?.cronTime?.source);
"
```

---

## 🔍 Monitoring & Verification

### Daily Monitoring Commands

**Check inactive users count:**
```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);
  const User = mongoose.model('User');
  const inactive = await User.countDocuments({ isActive: false });
  console.log('Users marked as inactive:', inactive);
  await mongoose.connection.close();
})();
"
```

**Check users inactive > 60 days:**
```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);
  const User = mongoose.model('User');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const inactive = await User.countDocuments({ lastActivityAt: { \$lt: cutoff } });
  console.log('Users inactive > 60 days:', inactive);
  await mongoose.connection.close();
})();
"
```

**Check migration status:**
```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);
  const User = mongoose.model('User');
  const total = await User.countDocuments();
  const withLastActivity = await User.countDocuments({ lastActivityAt: { \$exists: true } });
  console.log('Total users:', total);
  console.log('With lastActivityAt:', withLastActivity);
  console.log('Migration complete:', total === withLastActivity);
  await mongoose.connection.close();
})();
"
```

### Manual Cron Job Test

**Test cron job manually:**
```bash
node -e "
const mongoose = require('mongoose');
const { markInactiveUsers } = require('./common/activityTracker');
require('dotenv').config();

(async () => {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGODB_URI);
  console.log('🔄 Running inactive users check...');
  const result = await markInactiveUsers(60);
  console.log('✅ Complete! Modified:', result.modifiedCount, 'users');
  await mongoose.connection.close();
})();
"
```

---

## 🚨 Troubleshooting

### Issue: Migration Fails

**Check database connection:**
```bash
node test_db_connection.js
```

**Check environment variables:**
```bash
node -e "require('dotenv').config(); console.log('DB:', process.env.MONGODB_URL || process.env.MONGODB_URI);"
```

**Check database permissions:**
```bash
# Ensure user has write permissions
mongo "mongodb://your-production-server:27017/tutorhail_production" --eval "db.users.findOne()"
```

### Issue: Cron Job Not Running

**Check application logs:**
```bash
tail -f your-app.log | grep -i agenda
```

**Check if application restarted:**
```bash
ps aux | grep node
```

**Check cron job definition:**
```bash
node -e "console.log(require('./cron/cronjobs').checkInactiveUsers ? 'Defined' : 'Not defined');"
```

### Issue: Admin Endpoints Not Working

**Check authentication:**
```bash
curl -X POST "https://your-domain.com/api/v1/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'
```

**Check route registration:**
```bash
# Verify routes are registered
grep -r "getInactiveUsers" v1/routes/
```

### Issue: Performance Problems

**Check database indexes:**
```bash
mongo "mongodb://your-production-server:27017/tutorhail_production" --eval "db.users.getIndexes()"
```

**Check query performance:**
```bash
# Explain query for inactive users
mongo "mongodb://your-production-server:27017/tutorhail_production" --eval "
db.users.find({
  lastActivityAt: { \$lt: new Date('2024-08-16') },
  isActive: true
}).explain('executionStats')
"
```

---

## 🔄 Rollback Plan

**If something goes wrong, rollback migration:**

```bash
# Rollback migration (removes new fields)
node migrations/migrate_activity_fields.js --rollback
```

**Restore from backup:**
```bash
# Restore database from backup
mongorestore --uri="mongodb://your-production-server:27017/tutorhail_production" /backup/before-activity-tracking-YYYYMMDD_HHMMSS
```

---

## 📈 Success Metrics

**Production is successful when:**
- ✅ Migration completed without errors
- ✅ All 8 tests pass
- ✅ Admin endpoints return data
- ✅ Cron job runs daily at 2 AM
- ✅ Activity tracking updates `lastActivityAt`
- ✅ No performance degradation
- ✅ Monitoring in place

---

## 🎯 Timeline

**Day 1:**
1. Deploy code to production
2. **Run migration script** (one-time)
3. Verify migration success
4. Add activity tracking middleware
5. Restart application
6. Test endpoints

**Day 2:**
1. Monitor cron job logs
2. Check inactive user detection
3. Verify activity tracking

**Day 3+:**
1. Daily monitoring
2. Re-engagement campaigns
3. Performance optimization

---

## 📞 Support

**For issues or questions:**
- Check logs: `tail -f your-app.log`
- Run tests: `node test_activity_tracking.js`
- Check database: Use monitoring commands above
- Rollback if needed: `node migrations/migrate_activity_fields.js --rollback`

---

## 🎉 Summary

**The critical steps for production:**
1. ✅ Deploy code
2. ⚠️ **Run migration**: `node migrations/migrate_activity_fields.js`
3. ⚠️ **Restart app** (to activate cron job)
4. ✅ Add middleware to routes
5. ✅ Test endpoints

**Once complete, the system will:**
- ✅ Automatically track user activity
- ✅ Mark users inactive after 60 days (daily at 2 AM)
- ✅ Provide admin insights
- ✅ Support re-engagement campaigns

**You're ready for production!** 🚀

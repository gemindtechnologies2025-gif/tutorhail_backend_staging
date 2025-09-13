# 🚀 TutorHail Backend - Local Development Setup

## 📋 Prerequisites

1. **Node.js** (v14+ recommended, currently using v22.18.0)
2. **SSH access** to remote MongoDB server
3. **tutor.pem** key file with proper permissions

## 🔧 Quick Setup

### 1. SSH Tunnel Setup (Terminal 1)
```bash
# Make sure you have the tutor.pem file in your Documents directory
chmod 400 ~/Documents/tutor.pem

# Create SSH tunnel to MongoDB
ssh -i ~/Documents/tutor.pem -L 27020:localhost:27017 ubuntu@40.172.30.135
```
**Keep this terminal open** - the SSH tunnel must remain active.

### 2. Start Application (Terminal 2)
```bash
# Navigate to project directory
cd "/Users/gurjitsingh/Documents/GeMind Technology/Repo/tutorhail_backend_phase2-staging"

# Start the application
npm start
```

## 🌐 Access Points

- **API Documentation**: http://localhost:4001/api-docs/
- **API Base URL**: http://localhost:4001/api/v1/
- **Server Port**: 4001

## ✅ Verification Commands

### Check SSH Tunnel
```bash
netstat -an | grep 27020
# Should show: tcp4 0 0 127.0.0.1.27020 *.* LISTEN
```

### Test API
```bash
# Health check
curl http://localhost:4001/api-docs/

# Test Parent signup
curl -X POST http://localhost:4001/api/v1/Parent/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Parent",
    "email": "test@example.com",
    "phoneNo": "1234567890",
    "dialCode": "+1",
    "password": "Test123!"
  }'
```

## 📊 Expected Startup Logs
```
Environment: develop
Running on: 4001
start socketInitialize
Agenda Started
Swagger file created
Mongo Connected to mongodb://localhost:27020/tutor_alvin_staging
CRON Started--------------- every 1 min
```

## 🔧 Configuration Details

- **Database**: Connected to staging DB via SSH tunnel (port 27020 → 27017)
- **Environment**: Development mode with AWS dev bucket
- **Firebase**: Conditionally disabled (no private key)
- **Port**: 4001 (different from staging to avoid conflicts)

## 🚨 Important Notes

1. **SSH Tunnel Required**: Must keep SSH connection active
2. **Staging Database**: All operations affect staging data
3. **Firebase Disabled**: Push notifications won't work without private key
4. **Security**: Never commit `.env.develop` to git (already in .gitignore)

## 🛠️ Troubleshooting

### MongoDB Connection Issues
- Verify SSH tunnel is active: `netstat -an | grep 27020`
- Restart SSH tunnel if needed

### Port Conflicts
- Kill existing processes: `lsof -ti:4001 | xargs kill -9`
- Or change PORT in `.env.develop`

### Application Won't Start
- Check Node.js version: `node --version`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## 📁 Project Structure

```
├── .env.develop          # Local environment config (gitignored)
├── common/functions.js   # Modified for Firebase conditional init
├── server.js            # Main application entry point
├── package.json         # Dependencies and scripts
└── LOCAL_SETUP.md       # This documentation
```

---
**Setup Complete!** 🎉 Your TutorHail backend is ready for local development!



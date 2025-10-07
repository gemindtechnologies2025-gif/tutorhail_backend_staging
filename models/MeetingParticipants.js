const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const meetingParticipantSchema = new Schema({
    // References
    classId: {
        type: ObjectId,
        ref: "classes",
        required: true,
        index: true
    },
    meetingId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        default: ""
    },
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    
    // Participant Information from Dyte
    peerId: {
        type: String,
        required: true
    },
    userDisplayName: {
        type: String,
        default: ""
    },
    customParticipantId: {
        type: String,
        default: ""
    },
    
    // Participant Role
    role: {
        type: String,
        enum: ['HOST', 'TUTOR', 'STUDENT', 'GUEST', ''],
        default: ""
    },
    
    // Join/Leave Information
    joinedAt: {
        type: Date,
        required: true,
        index: true
    },
    leftAt: {
        type: Date,
        default: null
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    isCurrentlyInMeeting: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Connection Statistics
    reconnections: {
        type: Number,
        default: 0
    },
    disconnections: {
        type: Number,
        default: 0
    },
    
    // Device Information (if available)
    deviceInfo: {
        deviceType: { type: String, default: "" },
        browser: { type: String, default: "" },
        os: { type: String, default: "" }
    },
    
    // Activity Tracking
    cameraEnabled: {
        type: Boolean,
        default: false
    },
    microphoneEnabled: {
        type: Boolean,
        default: false
    },
    screenShareEnabled: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    isDeleted: {
        type: Boolean,
        default: false
    }
    
}, {
    timestamps: true
});

// Indexes for better query performance
meetingParticipantSchema.index({ meetingId: 1, peerId: 1 });
meetingParticipantSchema.index({ classId: 1, userId: 1 });
meetingParticipantSchema.index({ joinedAt: -1 });

const MeetingParticipants = mongoose.model('meetingparticipants', meetingParticipantSchema);
module.exports = MeetingParticipants;


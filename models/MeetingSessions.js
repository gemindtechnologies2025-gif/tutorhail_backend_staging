const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const meetingSessionSchema = new Schema({
    // References
    classId: {
        type: ObjectId,
        ref: "classes",
        default: null,
        index: true
    },
    slotId: {
        type: ObjectId,
        ref: "classSlots",
        default: null,
        index: true
    },
    bookingId: {
        type: ObjectId,
        ref: "Booking",
        default: null,
        index: true
    },
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    
    // Dyte Meeting Information
    meetingId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sessionId: {
        type: String,
        default: ""
    },
    roomName: {
        type: String,
        default: ""
    },
    
    // Meeting Details
    title: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['CREATED', 'LIVE', 'ENDED', 'CANCELLED'],
        default: 'CREATED',
        index: true
    },
    
    // Organizer Information
    organizedBy: {
        id: { type: String, default: "" },
        name: { type: String, default: "" }
    },
    
    // Session Timing
    createdAt: {
        type: Date,
        default: null
    },
    startedAt: {
        type: Date,
        default: null,
        index: true
    },
    endedAt: {
        type: Date,
        default: null
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    
    // End Reason
    endReason: {
        type: String,
        enum: ['HOST_ENDED_MEETING', 'ALL_PARTICIPANTS_LEFT', 'TIMEOUT', 'ERROR', ''],
        default: ""
    },
    
    // Participant Statistics
    totalParticipants: {
        type: Number,
        default: 0
    },
    maxConcurrentParticipants: {
        type: Number,
        default: 0
    },
    participantList: [{
        peerId: { type: String },
        userDisplayName: { type: String },
        customParticipantId: { type: String },
        joinedAt: { type: Date },
        leftAt: { type: Date },
        duration: { type: Number } // in seconds
    }],
    
    // Recording Information
    recording: {
        id: { type: String, default: "" },
        status: { 
            type: String, 
            enum: ['INVOKED', 'RECORDING', 'UPLOADING', 'UPLOADED', 'ERRORED', ''],
            default: "" 
        },
        downloadUrl: { type: String, default: "" },
        startedTime: { type: Date, default: null },
        duration: { type: Number, default: 0 },
        size: { type: Number, default: 0 },
        outputFileName: { type: String, default: "" }
    },
    
    // Livestream Information
    livestream: {
        streamId: { type: String, default: "" },
        status: { 
            type: String,
            enum: ['LIVE', 'OFFLINE', 'IDLE', ''],
            default: ""
        },
        updatedAt: { type: Date, default: null }
    },
    
    // Chat Information
    chat: {
        downloadUrl: { type: String, default: "" },
        downloadUrlExpiry: { type: Date, default: null },
        syncedAt: { type: Date, default: null }
    },
    
    // Transcript Information
    transcript: {
        downloadUrl: { type: String, default: "" },
        downloadUrlExpiry: { type: Date, default: null },
        availableAt: { type: Date, default: null }
    },
    
    // Summary Information
    summary: {
        downloadUrl: { type: String, default: "" },
        downloadUrlExpiry: { type: Date, default: null },
        availableAt: { type: Date, default: null }
    },
    
    // Metadata
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
    
}, {
    timestamps: true
});

// Indexes for better query performance
meetingSessionSchema.index({ classId: 1, status: 1 });
meetingSessionSchema.index({ tutorId: 1, startedAt: -1 });
meetingSessionSchema.index({ meetingId: 1 }, { unique: true });

const MeetingSessions = mongoose.model('meetingsessions', meetingSessionSchema);
module.exports = MeetingSessions;


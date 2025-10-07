const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const meetingEventSchema = new Schema({
    // References
    classId: {
        type: ObjectId,
        ref: "classes",
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
    
    // Event Details
    eventType: {
        type: String,
        enum: [
            'meeting.started',
            'meeting.ended',
            'meeting.participantJoined',
            'meeting.participantLeft',
            'recording.statusUpdate',
            'livestreaming.statusUpdate',
            'meeting.chatSynced',
            'meeting.transcript',
            'meeting.summary'
        ],
        required: true,
        index: true
    },
    
    // Meeting Status
    meetingStatus: {
        type: String,
        enum: ['CREATED', 'LIVE', 'ENDED', 'CANCELLED'],
        default: 'CREATED'
    },
    
    // Meeting Metadata
    title: {
        type: String,
        default: ""
    },
    organizedBy: {
        id: { type: String, default: "" },
        name: { type: String, default: "" }
    },
    
    // Event Payload (store complete webhook data)
    eventPayload: {
        type: Schema.Types.Mixed,
        default: null
    },
    
    // Webhook Metadata
    webhookId: {
        type: String,
        default: ""
    },
    webhookUuid: {
        type: String,
        default: ""
    },
    
    // Timestamps
    eventReceivedAt: {
        type: Date,
        default: Date.now
    },
    isProcessed: {
        type: Boolean,
        default: false
    },
    processingError: {
        type: String,
        default: ""
    }
    
}, {
    timestamps: true
});

// Indexes for better query performance
meetingEventSchema.index({ meetingId: 1, eventType: 1 });
meetingEventSchema.index({ classId: 1, eventType: 1 });
meetingEventSchema.index({ createdAt: -1 });

const MeetingEvents = mongoose.model('meetingevents', meetingEventSchema);
module.exports = MeetingEvents;


const mongoose = require("mongoose");
const common = require('../common/index');
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants =  require('../common/constants');

const NotificationSchema = new mongoose.Schema({
    role: {
        type: Number,
        enum: Object.values(common.constants.ROLE)
    },
    pushType: {
        type: Number,
        enum: Object.values(common.constants.PUSH_TYPE_KEYS)
    },
    title: {
        type: String,
        default: ""
    },
    message: {
        type: String,
        default: ""
    },
    tutorId: {
        type: ObjectId,
        ref: "User",
        index: true
    },
    receiverId: {
        type: ObjectId,
        index: true
    },
    bookingId: {
        type: ObjectId,
        ref: "Booking",
        index: true
    },
    bookingDetailId: {
        type: ObjectId,
        ref: "BookingDetails",
        index: true
    },
    parentId: {
        type: ObjectId,
        ref: "User",
        index: true
    },
    contentId: {
        type: ObjectId,
        ref: "Content",
        index: true
    },
    classId: {
        type: ObjectId,
        ref: "Classes",
        index: true
    },
    recieverType: {
        type: Number,
        enum: Object.values(common.constants.RECIEVER_TYPE)
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    isBroadcast: {
        type: Boolean,
        default: false,
        index: true
    },
    query: {
        type: String,
        default: ""
    },
    revertQuery: {
        type: String,
        default: ""
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    },
    bookingStatus: {
        type: Number,
        enum: constants.BOOKING_STATUS,
        default: constants.BOOKING_STATUS.PENDING
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Notification", NotificationSchema);
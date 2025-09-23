const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants =  require('../common/constants');

let bookingDetailsModel = new Schema({
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
    date: {
        type: Date,
        default: null
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    },
    customTime: {
        type: Boolean,
        default: false
    },
    classStart: {
        type: Date,
        default: null
    },
    classEnd: {
        type: Date,
        default: null
    },
    noOfHours: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        default: 0
    },
    distance: {
        type: Number,
        default: 0
    },
    transportationFees: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    bookingStatus: {
        type: Number,
        enum: constants.BOOKING_STATUS,
        default: constants.BOOKING_STATUS.PENDING
    },
    pairingType: {
        type: Number,
        enum: constants.PAIRING_TYPE,
        default: constants.PAIRING_TYPE.PENDING
    },
    callJoinedByTutor: {
        type: Boolean,
        default: false
    },
    callJoinedByParent: {
        type: Boolean,
        default: false
    },
dyteMeeting: {
        type: Schema.Types.Mixed,
        default: null
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

module.exports = mongoose.model('BookingDetails', bookingDetailsModel);

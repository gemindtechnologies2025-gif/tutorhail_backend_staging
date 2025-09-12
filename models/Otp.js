const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');
//const moment =  require('moment');

const OtpModel = new Schema({
    otp: {
        type: String,
        default: "",
        trim: true
    },
    phoneNo: {
        type: String,
        trim: true,
        default: "",
        index: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
        index: true
    },
    dialCode: {
        type: String,
        default: "",
        trim: true,
        index: true
    },
    expiredAt: {
        type: Date,
        default: new Date()
    },
    parentId: {
        type: ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    tutorId: {
        type: ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    bookingId: {
        type: ObjectId,
        ref: 'Booking',
        default: null,
        index: true
    },
    bookingDetailId: {
        type: ObjectId,
        ref: 'BookingDetails',
        default: null,
        index: true
    },
    type: {
        type: Number,
        enum:Object.values(constants.VERIFICATION_TYPE)
    },
    pairingType: {
        type: Number,
        enum:Object.values(constants.PAIRING_TYPE)
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
    // otpExpiry: {
    //     type: Date,
    //     default: () => moment().add(5, 'minutes')
    // }
}, {
    timestamps: true,
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true
    }
});
const Otp = mongoose.model('Otp', OtpModel);
module.exports = Otp;
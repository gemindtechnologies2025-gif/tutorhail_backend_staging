const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

let bookingModel = new Schema({
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    parentAddressId: {
        type: ObjectId,
        ref: "ParentAddress",
        default: null,
        index: true
    },
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    bookedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    subjectId: [{
        type: ObjectId,
        ref: "Subjects",
        default: null,
        index: true
    }],
    classId: {
        type: Number,
        enum: Object.values(constants.GRADE_TYPE)
    },
    bookClassId: {
        type: ObjectId,
        ref: "classes",
        default: null,
        index: true
    },
    classSlotIds: [{
        type: ObjectId,
        ref: "classSlots",
        default: null,
        index: true
    }],
    bookType: {
        type: Number,
        enum: Object.values(constants.BOOK_TYPE)
    },
    bookFor: {
        type: Number,
        enum: Object.values(constants.BOOK_FOR)
    },
    slotType: {
        type: Number,
        enum: Object.values(constants.CLASS_BOOK)
    },
    name: {
        type: String
    },
    email: {
        type: String
    },
    classPrice: {
        type: Number
    },
    bookingNumber: {
        type: String
    },
    totalNoOfHours: {
        type: Number
    },
    totalPrice: {
        type: Number
    },
    discountAmount: {
        type: Number
    },
    bookingStatus: {
        type: Number,
        enum: constants.BOOKING_STATUS,
        default: constants.BOOKING_STATUS.PENDING
    },
    cancelReason: {
        type: String
    },
    totalDistance: {
        type: Number
    },
    totalTransportationFees: {
        type: Number
    },
    serviceFees: {
        type: Number
    },
    grandTotal: {
        type: Number
    },
    isRated: {
        type: Boolean,
        default: false
    },
    refundAmount: {
        type: Number
    },
    isRefunded: {
        type: Boolean,
        default: false
    },
    refundRequest: {
        type: Boolean,
        default: false
    },
    refundDate: {
        type: Date
    },
    OrderTrackingId: {
        type: String
    },
    confirmationCode: {
        type: String
    },
    invoiceNo: {
        type: String
    },
    refundType: {
        type: Number,
        enum: constants.REFUND_TYPE
    },
    refundStatus: {
        type: Number,
        enum: constants.REFUND_STATUS
    },
    refundRejectReason: {
        type: String
    },
    additionalInfo: {
        type: String
    },
    learnToday: {
        type: String
    },
    classModeOnline: {
        type: Boolean,
        default: false
    },
    cancelledAt: {
        type: Date
    },
    acceptedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    tutorMoney: {
        type: Number
    },
    serviceType: {
        type: Number,
        enum : Object.values(constants.SERVICE_TYPE)
    },
    serviceCharges: {
        type: Number
    },
    promocodeId: {
        type: ObjectId,
        ref: "PromoCode",
        default: null,
        index: true
    },
    paymentType: {
        mode: {
            type: Number,
            enum: Object.values(constants.PAYMENT_TYPE)
        },
        card: {
            type: String,
            default: ""
        }
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
module.exports = mongoose.model('Booking', bookingModel);
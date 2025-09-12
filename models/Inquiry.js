const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const inquiryModel = new Schema({
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    type: { 
        type: Number,   
        enum: Object.values(constants.INQUIRY_TYPE) 
    },
    status: { 
        type: Number, 
        enum: Object.values(constants.INQUIRY_STATUS) 
    },
    other: {
        type: String
    },
    revert: {
        type: String
    },
    tutorRevert: {
        type: String
    },
    name: {
        type: String
    },
    email: {
        type: String
    },
    isForward: {
        type: Boolean,
        default: false,
        index: true
    },
    isGuest: {
        type: Boolean,
        default: false,
        index: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

const Inquiry = mongoose.model('Inquiry', inquiryModel);
module.exports = Inquiry;
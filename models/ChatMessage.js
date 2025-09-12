const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants =  require('../common/constants');

const chatMessageModel = new Schema({
    connectionId: {
        type: String,
        default: null,
        index: true
    },
    bookingId: {
        type: ObjectId,
        ref: "Booking",
        default: null,
        index: true
    },
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
        enum: Object.values(constants.CHAT_TYPE)
    },
    sentBy: {
        type: Number,
        enum: Object.values(constants.APP_ROLE)
    },
    message: {
        type: String
    },
    uploads: [{
        type: String,
        default: []
    }],
    uploadType : {
        type: String,
        enum: Object.values(constants.CHAT_MEDIA),
        default : constants.CHAT_MEDIA.TEXT
    },
    isParentRead: {
        type: Boolean,
        default: false
    },
    isTutorRead: {
        type: Boolean,
        default: false
    },
    isTutorBlocked: {
        type: Boolean,
        default: false
    },
    isParentBlocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
const chatMessage = mongoose.model('chatMessage', chatMessageModel);
module.exports = chatMessage;
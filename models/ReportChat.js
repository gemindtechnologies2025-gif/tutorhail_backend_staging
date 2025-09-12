const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const reportChatModel = new Schema({
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
    chatId: {
        type: String,
        default: ""
    },
    reportBy: {
       type: Number,
       enum : Object.values(constants.APP_ROLE)
    },
    report: { 
        type: Number,
        enum : Object.values(constants.REPORT_CHAT)
    },
    screenshot: {
        type: String
    },
    details: {
        type: String
    },
    type: { 
        type: Number,
        enum : Object.values(constants.CHAT_REPORT)
    },
    revert: {
        type: String
    },
    status: { 
        type: Number, 
        enum: Object.values(constants.INQUIRY_STATUS),
        default: constants.INQUIRY_STATUS.PENDING
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    } 
}, {
    timestamps: true
});

const ReportChat = mongoose.model('ReportChat', reportChatModel);
module.exports = ReportChat;
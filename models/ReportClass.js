const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const reportClassModel = new Schema({
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    classId: {
        type: ObjectId,
        ref: "Classes",
        default: null,
        index: true
    },
    report: {
        type: Number,
        enum : Object.values(constants.REPORT)
    },
    reason: {
        type: String
    },
    status: { 
        type: Number, 
        enum: Object.values(constants.INQUIRY_STATUS) 
    },
    revert: {
        type: String
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    } 
}, {
    timestamps: true
});

const ReportClass = mongoose.model('ReportClass', reportClassModel);
module.exports = ReportClass;
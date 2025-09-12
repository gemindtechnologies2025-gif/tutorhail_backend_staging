const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

let tutorWithdrawSchema = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "Tutor",
        default: null,
        index: true
    },
    withdraw: {
        type: Number,
        default: "",
        index: true
    },
    withdrawStatus: {
        type: Number,
        enum: Object.values(constants.WITHDRAW_STATUS),
        default: constants.WITHDRAW_STATUS.PENDING
    },
    withdrawMode: {
        type: Number,
        enum: Object.values(constants.WITHDRAW_MODE)
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

const TutorWithdraw = mongoose.model('TutorWithdraw', tutorWithdrawSchema);
module.exports = TutorWithdraw;
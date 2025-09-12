const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const classSlotsModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    classId: {
        type: ObjectId,
        ref: "classes",
        default: null,
        index: true
    },
    timezone: {
        type: String,
        default: ""
    },
    date: {
        type: Date
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    seats: {
        type: Number,
        default: 0
    },
    remainingSeats: {
        type: Number,
        default: 0
    },
    status: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});
const classSlots = mongoose.model('classSlots', classSlotsModel);
module.exports = classSlots;
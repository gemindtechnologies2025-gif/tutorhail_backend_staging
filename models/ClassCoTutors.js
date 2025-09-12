const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const classCoTutorsModel = new Schema({
    classId: {
        type: ObjectId,
        ref: "Classes",
        default: null,
        index: true
    },
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    status: { 
        type: Number, 
        enum: Object.values(constants.TUTOR_STATUS), 
        default: constants.TUTOR_STATUS.PENDING 
    }
}, {
    timestamps: true
});

const ClassCoTutors = mongoose.model('ClassCoTutors', classCoTutorsModel);
module.exports = ClassCoTutors;
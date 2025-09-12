const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

let subjectSpecializationModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "Tutor",
        default: null,
        index: true
    },
    specializationType:{
        type: Number,
        enum: Object.values(constants.SPECIALIZATION_TYPE)
    },
    name: {
        type: String,
        default: ""
    },
    isDeleted:{
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

const SubjectSpecialization = mongoose.model('SubjectSpecialization', subjectSpecializationModel);
module.exports = SubjectSpecialization;
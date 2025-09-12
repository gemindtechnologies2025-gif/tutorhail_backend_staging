const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const tutorViewsModel = new Schema({
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
    }
}, {
    timestamps: true
});

const TutorViews = mongoose.model('TutorViews', tutorViewsModel);
module.exports = TutorViews;
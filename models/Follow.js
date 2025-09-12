const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const followModel = new Schema({
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
    isRead: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

const Follow = mongoose.model('Follow', followModel);
module.exports = Follow;
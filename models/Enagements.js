const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const engagementModel = new Schema({
    contentId: {
        type: ObjectId,
        ref: "Content",
        default: null,
        index: true
    },
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    engagementType: {
        type: Number,
        enum: Object.values(constants.ENGAGEMENTS)
    }
}, {
    timestamps: true
});
const Engagement = mongoose.model('Engagement', engagementModel);
module.exports = Engagement;
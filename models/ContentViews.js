const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const contentViewsModel = new Schema({
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    contentId: {
        type: ObjectId,
        ref: "Content",
        default: null,
        index: true
    }
}, {
    timestamps: true
});

const ContentViews = mongoose.model('ContentViews', contentViewsModel);
module.exports = ContentViews;
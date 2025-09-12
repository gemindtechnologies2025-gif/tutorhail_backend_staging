const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const commentLikeModel = new Schema({
    commentId: {
        type: ObjectId,
        ref: "Comment",
        default: null,
        index: true
    },
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    }
}, {
    timestamps: true
});
const CommentLike = mongoose.model('CommentLike', commentLikeModel);
module.exports = CommentLike;
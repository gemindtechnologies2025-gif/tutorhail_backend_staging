const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const commentReplyModel = new Schema({
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
    },
    reply: {
        type: String
    },
    image: {
        type: String
    }
}, {
    timestamps: true
});
const CommentReply = mongoose.model('CommentReply', commentReplyModel);
module.exports = CommentReply;
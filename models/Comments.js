const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const commentModel = new Schema({
  contentId: {
    type: ObjectId,
    ref: "Content",
    default: null,
    index: true
  },
  userId: {
    type: ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  commentText: {
    type: String
  },
  image: {
    type: String
  },
  likeCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Comment', commentModel);

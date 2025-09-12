const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const giftModel = new Schema({
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
  amount: {
    type: Number
  },
  note: {
    type: String
  },
  invoiceNo: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gifts', giftModel);

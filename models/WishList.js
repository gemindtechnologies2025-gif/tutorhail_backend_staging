const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const WishlistSchema = new Schema({
     tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
      },
      parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
      }
}, {
    timestamps: true
});
const Wishlist = mongoose.model('WishList', WishlistSchema);
module.exports = Wishlist;
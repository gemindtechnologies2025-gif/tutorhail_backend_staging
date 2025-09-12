const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

let cartModel = new Schema({
    cartId: {
        type: String,
        default: null,
        index: true
    },
    body: {
        type: JSON
    },
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    order_tracking_id: {
        type: String,
        default: null
    }
},{
    timestamps: true,
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

module.exports = mongoose.model('Cart', cartModel);
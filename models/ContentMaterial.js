const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

let ContentMaterialModel = new Schema({
    bookingId: {
        type: ObjectId,
        ref: "Booking",
        default: null,
        index: true
    },
    bookingDetailId: {
        type: ObjectId,
        ref: "BookingDetails",
        default: null,
        index: true
    },
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
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    content: {
        type: String,
        default: ""
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    } 
}, {
    timestamps: true,
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    }
});

module.exports = mongoose.model('ContentMaterial', ContentMaterialModel);
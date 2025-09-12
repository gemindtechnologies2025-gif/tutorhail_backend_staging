const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

let RatingModel = new Schema({
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
    bookingId: {
        type: ObjectId,
        ref: "Booking",
        default: null,
        index: true
    },
    classId: {
        type: ObjectId,
        ref: "Classes",
        default: null,
        index: true
    },
    rating: {
        type: Number,
        default: 0
    },
    review: {
        type: String,
        default: ""
    },
    ratingType: {
        type: Number,
        enum : Object.values(constants.RATING_TYPE)
    },
    type: {
        type: Number,
        enum : Object.values(constants.RATE_WAY)
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
RatingModel.index({ parentId: 1 }, { sparse: true });
RatingModel.index({ tutorId: 1 }, { sparse: true });

module.exports = mongoose.model('Rating', RatingModel);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const socialLinkModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    type: {
        type: Number,
        enum: Object.values(constants.SOCIAL_TYPE)
    },
    link: {
        type: String,
        default: ""
    },
    isDeleted:{
      type:Boolean,
      default:false,
      index: true
    }
}, {
    timestamps: true
});
const SocialLinks = mongoose.model('SocialLinks', socialLinkModel);
module.exports = SocialLinks;
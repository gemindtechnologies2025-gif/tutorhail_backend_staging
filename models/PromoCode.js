const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const promocodeModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    name: {
        type: String,
        default: ""
    },
    codeName: {
        type: String,
        default: ""
    },
    discountType: {
        type: Number,
        enum: Object.values(constants.SERVICE_TYPE)
    },
    discount: {
        type: Number,
        default: ""
    },
    maxUser: {
        type: Number,
        default: 0
    },
    usedCount: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date
    },
    startDate: {
        type: Date
    },
    type: {
        type: Number,
        enum: Object.values(constants.PROMOCODE_TYPE)
    },
    setting: {
        type: Number,
        enum: Object.values(constants.SETTING)
    },
    allClasses:{
      type: Boolean,
      default: false
    },
    classIds: [{
        type: ObjectId,
        ref: "classes",
        default: null,
        index: true
    }],
    isDeleted:{
      type:Boolean,
      default:false,
      index: true
    },
    status:{
      type:Boolean,
      default:true,
      index: true
    }
}, {
    timestamps: true
});
const PromoCode = mongoose.model('PromoCode', promocodeModel);
module.exports = PromoCode;
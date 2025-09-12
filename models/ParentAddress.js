const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const parentAddressModel = new Schema({
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null
    },
    houseNumber:{
      type:String,
      default:""
    },
    landMark:{
      type: String,
      default: ''
    },
    streetAddress:{
      type: String,
      default: ''
    },
    city: {
        type: String,
        trim: true,
        default: ""
    },
    country: {
        type: String,
        trim: true,
        default: ""
    },
    latitude: {
      type: Number,
      default: 0
    },
    longitude: {
      type: Number,
      default: 0
    },
    location: {
      type: {
        type: String,
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    },
    isDeleted:{
      type:Boolean,
      default:false,
      index: true
    },
    addressType: {
      type: Number,
      enum: [constants.ADDRESS_TYPE.HOME, constants.ADDRESS_TYPE.WORK, constants.ADDRESS_TYPE.OTHER],
      default: constants.ADDRESS_TYPE.OTHER
  }
}, {
    timestamps: true,
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true
    }
});
parentAddressModel.index({
    location: "2dsphere"
});
const parentAddress = mongoose.model('parentAddress',  parentAddressModel );
module.exports = parentAddress;
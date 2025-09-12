const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

let customerSupportModel = new Schema({
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
        default: null
    },
    query: {
        type: String,
        default: null
    },
    revertQuery: {
        type: String,
        default: null
    },
    customerType: {
        type: Number,
        enum: Object.values(constants.CUSTOMER_TYPE)
      },
    supportType:{
        type: Number,
        enum: Object.values(constants.SUPPORT_TYPE)
    },
    isDeleted : {
        type : Boolean,
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

module.exports = mongoose.model('customerSupport', customerSupportModel);
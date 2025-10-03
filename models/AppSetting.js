const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const constants = require('../common/constants');

let AppSettingModel = new Schema({
    distanceType: {
        type: Number,
        enum : Object.values(constants.DISTANCE_TYPE)
    },
    distanceAmount: {
        type: Number,
        default: 0
    },
    serviceType: {
        type: Number,
        enum : Object.values(constants.SERVICE_TYPE),
        index: true
    },
    serviceFees: {
        type: Number,
        default: 0
    },
    countryCode: {
        type: String,
        default: "",
        index: true
    },
    currency: {
        type: String,
        default: "",
        index: true
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

module.exports = mongoose.model('AppSetting', AppSettingModel);
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
        enum : Object.values(constants.SERVICE_TYPE)
    },
    serviceFees: {
        type: Number,
        default: 0
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
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const classModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    subjectId: {
        type: ObjectId,
        ref: "Subjects",
        default: null,
        index: true
    },
    grades: [{
        type: Number,
        enum: Object.values(constants.GRADE_TYPE)
    }],
    topic: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    objective: {
        type: String,
        default: ""
    },
    allOutcome: {
        type: String,
        default: ""
     },
    mostOutcome: {
        type: String,
        default: ""
     },
    someOutcome: {
        type: String,
        default: ""
    },
    thumbnail: {
        type: String,
        default: ""
    },
    teaser: {
        type: String,
        default: ""
    },
    material: [{
        type: String,
        default: ""
    }],
    isFreeLesson:{
      type: Boolean,
      default: false
    },
    duration: {
        type: Number,
        default: 0
    },
    fees: {
        type: Number,
        default: 0
    },
    totalFees: {
        type: Number,
        default: 0
    },
    usdPrice: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: ""
    },
    payment: {
        type: Number,
        enum: Object.values(constants.CLASS_PAYMENT)
    },
    seats: {
        type: Number,
        default: 0
    },
    classMode: {
        type: Number,
        enum: Object.values(constants.CLASS_MODE)
    },
    searchTags: [{
        type: String,
         default: ""
    }],
    language: {
        type: Number,
        enum: Object.values(constants.TEACHING_LANGUAGE)
    },
    notes: {
        type: String,
        default: ""
    },
    address: {
        type: String,
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
    canBePrivate: {
        type: Boolean,
        default: false
    },
    setting: {
        type: Number,
        enum: Object.values(constants.SETTING)
    },
    startDate: {
        type: Date
    },
    lastDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    typeOfClass: {
        type: Number,
        enum: Object.values(constants.CLASS_TYPE)
    },
    selectedSlots : [{
       start: {
         type: String
       },
       end: {
         type: String
       }
    }],
    avgRating: { 
        type: Number, 
        default: 0 
    },
    bookCount: {
        type: Number,
        default: 0
    },
    repeatEvery: {
        type: Number,
        default: 0
    },
    continueFor: {
        type: Number,
        default: 0
    },
    shareCount: {
        type: Number,
        default: 0
    },
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
const classes = mongoose.model('classes', classModel);
module.exports = classes;
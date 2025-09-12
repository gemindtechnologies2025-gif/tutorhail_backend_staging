const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require("../common/constants");

let teachingDetailModel = new Schema(
  {
    tutorId: {
      type: ObjectId,
      ref: "Tutor",
      default: null,
      index: true
    },
    totalTeachingExperience: {
      type: Number,
      default: 0,
      index: true
    },
    teachingStyle: [{
      type: Number,
      enum: Object.values(constants.TEACHING_STYLE),
      index: true
    }],
    curriculum: [{
      type: Number,
      enum: Object.values(constants.CURRICULUM),
      index: true
    }],
    curriculumOther: {
      type: String,
      default: ""
    },
    categoryId: [{
      type: ObjectId,
      ref: "Category",
      default: null,
      index: true
    }],
    subjectIds: [{
      type: ObjectId,
      ref: "Subjects",
      default: null,
      index: true
    }],
    classes: [{
      type: Number,
      enum: Object.values(constants.GRADE_TYPE),
      index: true
    }],
    otherClass: {
      type: String,
      default: ""
    },
    teachingLanguage: {
      type: Number,
      enum: Object.values(constants.TEACHING_LANGUAGE),
      index: true
    },
    startTime: {
      type: Date,
      default: null,
      index: true
    },
    endTime: {
      type: Date,
      default: null,
      index: true
    },
    price: {
      type: Number,
      default: 0,
      index: true
    },
    usdPrice: {
      type: Number,
      default: 0,
    },
    specialization: {
        type: String,
        default:""
    },
    achievement: {
        type: String,
        default:""
    },
    higherEdu:{
      type: Number,
      enum: Object.values(constants.EDU_DOC)
    },
    country: {
      type: String,
      default: ""
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true
    },
    toObject: {
      virtuals: true
    }
  }
);

const TeachingDetails = mongoose.model("TeachingDetails", teachingDetailModel);
module.exports = TeachingDetails;

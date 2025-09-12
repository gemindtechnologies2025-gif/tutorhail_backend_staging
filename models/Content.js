const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const contentModel = new Schema({
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    createdBy: {
        type: Number, 
        enum: Object.values(constants.APP_ROLE)
    },
    contentType: {
        type: Number,
        enum: Object.values(constants.CONTENT_TYPE)
    },
    uploadType: {
        type: Number,
        enum: Object.values(constants.UPLOAD_TYPE)
    },
    images: [{
        type: String
    }],
    title: {
        type: String
    },
    topic: {
        type: String
    },
    description: {
        type: String
    },
    categoryId: {
      type: ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    subjectId: [{
        type: ObjectId,
        ref: "Subjects",
        default: null,
        index: true
    }],
    gradeId: {
       type: Number,
       enum: Object.values(constants.GRADE_TYPE)
    },
    language: {
        type: Number,
        enum: Object.values(constants.TEACHING_LANGUAGE)
    },
    allowComments: {
        type:Boolean,
        default:true,
        index: true
    },
    visibility: {
        type: Number,
        enum: Object.values(constants.VISIBILITY)
    },
    upVoteCount: {
        type: Number,
        default: 0
    },
    downVoteCount: {
        type: Number,
        default: 0
    },
    likeCount: {
        type: Number,
        default: 0
    },
    commentCount: {
        type: Number,
        default: 0
    },
    shareCount: {
        type: Number,
        default: 0
    },
    saveCount: {
        type: Number,
        default: 0
    },
    giftCount: {
        type: Number,
        default: 0
    },
    views: {
        type: Number,
        default: 0
    },
    viewedBy: [{
        type: ObjectId,
        ref: "User"
    }],
    setting: {
        type: Number,
        enum: Object.values(constants.SETTING),
        default: constants.SETTING.PUBLISH
    },
    isAnonymous:{
      type:Boolean,
      default:false,
      index: true
    },
    giftsEarn: { 
        type: Number, 
        default: 0 
    },
    question: {
        type: String
    },
    duration: {
        type: Number,
        enum: Object.values(constants.POLL_DURATION)
    },
    votesCount: {
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
const Content = mongoose.model('Content', contentModel);
module.exports = Content;
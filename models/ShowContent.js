const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const showContentSchema = new Schema({
     tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
      },
      parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
      },
      type: {
        type: Number,
        enum: Object.values(constants.SHOW_CONTENT)
      },
      duration: {
        type: Number
      },
      durationType: {
        type: Number,
        enum: Object.values(constants.DURATION_TYPE)
      }
}, {
    timestamps: true
});
const ShowContent = mongoose.model('ShowContent', showContentSchema);
module.exports = ShowContent;
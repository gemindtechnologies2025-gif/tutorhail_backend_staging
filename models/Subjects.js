const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let subjectModel = new Schema({
    categoryId: {
      type: ObjectId,
      ref: "Category",
      default: null,
      index: true
    },
    name: {
        type: String,
        default: "",
    },
    status: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
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

module.exports = mongoose.model('Subjects', subjectModel);
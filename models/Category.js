const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let categoryModel = new Schema({
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

module.exports = mongoose.model('Category', categoryModel);
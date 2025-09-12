const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const classSaveModel = new Schema({
    classId: {
        type: ObjectId,
        ref: "Classes",
        default: null,
        index: true
    },
    parentId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    }
}, {
    timestamps: true
});

const ClassSave = mongoose.model('ClassSave', classSaveModel);
module.exports = ClassSave;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const pollOptionsModel = new Schema({
    contentId: {
        type: ObjectId,
        ref: "Content",
        default: null,
        index: true
    },
    option: {
        type: String
    },
    votes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});
const PollOptions = mongoose.model('PollOptions', pollOptionsModel);
module.exports = PollOptions;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const pollVotesModel = new Schema({
    pollOptionId: {
        type: ObjectId,
        ref: "PollOptions",
        default: null,
        index: true
    },
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
}, {
    timestamps: true
});
const PollVotes = mongoose.model('PollVotes', pollVotesModel);
module.exports = PollVotes;
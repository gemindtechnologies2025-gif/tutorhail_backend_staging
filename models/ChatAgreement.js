const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatAgreementSchema = new Schema({
    chatId: {
        type: String
    },
    parent: {
       type: Boolean,
       default: false
    },
    tutor: {
       type: Boolean,
       default: false
    }
}, {
    timestamps: true
});
const ChatAgreement = mongoose.model('ChatAgreement', chatAgreementSchema);
module.exports = ChatAgreement;
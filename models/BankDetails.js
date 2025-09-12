const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

let BankDetailModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null,
        index: true
    },
    accountNumber: {
        type: String,
        default: ""
      },
      accountHolderName: {
        type: String,
        default: ""
      },
      swiftCode: {
        type: String,
        default: ""
      },
      bankName: {
        type: String,
        default: ""
      },
      country: {
        type: String,
        default: ""
      },
      bankAddress: {
        type: String,
        default: ""
      },
      isDeleted: {
        type: Boolean,
        default: false,
        index: true
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

module.exports = mongoose.model('BankDetails',  BankDetailModel);
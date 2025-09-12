const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;
const constants = require('../common/constants');

const requiredDocumentModel = new Schema({
    tutorId: {
        type: ObjectId,
        ref: "User",
        default: null
    },
    frontImage: {
        type: String,
        default:""
    },
    backImage: {
        type: String,
        default:""
    },
    description: {
        type: String,
        default:""
    },
    documentType: {
        type: Number,
        enum: Object.values(constants.DOCUMENT_TYPE)
    },
    documentName:{
        type: Number,
        enum: Object.values(constants.DOCUMENT_NAME)
    },
    eduDocs:{
        type: Number,
        enum: Object.values(constants.EDU_DOC)
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    institutionName: {
        type: String,
        default:""
    },
    fieldOfStudy: {
        type: String,
        default:""
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    longitude: {
        type: Number,
        default: 0
      },
      latitude: {
        type: Number,
        default: 0
      },
      location: {
        type: {
          type: String,
          default: "Point"
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      },
      onGoing : {
        type: Boolean,
        default: false
      }
}, {
    timestamps: true,
    toObject: {
        virtuals: true
    },
    toJSON: {
        virtuals: true
    }
});


requiredDocumentModel.pre(/save|create|update/i, function (next) {
    if (this.get("latitude") && this.get("longitude")) {
      const longitude = this.get("longitude");
      const latitude = this.get("latitude");
      const location = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      this.set({
        location
      });
    }
    next();
  });
  
const requiredDocument = mongoose.model('RequiredDocument', requiredDocumentModel);
module.exports = requiredDocument;
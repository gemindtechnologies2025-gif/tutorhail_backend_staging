const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let cmsModel = new Schema({
    privacyPolicy: {
        type: String,
        default: null,
        index: true
    },
    termsAndConditions: {
        type: String,
        default: null,
        index: true
    },
    cancellationPolicy: {
        type: String,
        default: null
    },
    refundPolicy: {
        type: String,
        default: null
    },
    customerPolicy: {
        type: String,
        default: null
    },
    aboutUs: {
        type: String,
        default: null
    },
    eula: {
        type: String,
        default: null
    },
    contactSupport: {
        dialCode: {
            type: String,
            default: null
        },
        phoneNo: {
            type: String,
            default: null
        },
        email: {
            type: String,
            default: null
        }
    },
    faq: [{
        question: {
            type: String,
            default: ""
        },
        answer: {
            type: String,
            default: ""
        }
    }],
    dataProcessingAgreement: {
        type: String,
        default: null
    },
    communityGuidelines: {
        type: String,
        default: null
    },
    cookiePolicy: {
        type: String,
        default: null
    },
    dataProcessingAgreementUpdatedAt: {
        type: Date,
        default: null
    },
    communityGuidelinesUpdatedAt: {
        type: Date,
        default: null
    },
    cookiePolicyUpdatedAt: {
        type: Date,
        default: null
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

module.exports = mongoose.model('cms', cmsModel);
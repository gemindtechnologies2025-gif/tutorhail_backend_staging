const Joi = require("joi").defaults((schema) => {
    switch (schema.type) {
        case "string":
            return schema.replace(/\s+/, " ");
        default:
            return schema;
    }
});

Joi.objectId = () => Joi.string().pattern(/^[0-9a-f]{24}$/, "valid ObjectId");

module.exports.identify = Joi.object({
    id: Joi.objectId().required()
});

module.exports.register = Joi.object({
    email: Joi.string().email().required().error(new Error("Please Enter a valid email")),
    password: Joi.string().required(),
    dialCode: Joi.string().optional(),
    phoneNo: Joi.string().optional(),
    deviceToken: Joi.string().optional(),
    deviceType: Joi.string().optional()
});
module.exports.login = Joi.object({
    email: Joi.string().email().required().error(new Error("Please Enter a valid email")),
    password: Joi.string().required(),
    deviceToken: Joi.string().optional(),
    deviceType: Joi.string().optional()
});
module.exports.updateProfile = Joi.object({
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    address: Joi.string().optional(),
    isBlocked: Joi.boolean().optional(),
    isDeleted: Joi.boolean().optional()
});
module.exports.changePassword = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required()
});
module.exports.resetPassword = Joi.object({
    newPassword: Joi.string().required()
});
module.exports.forgotPassword = Joi.object({
    email: Joi.string().email().required()
});
module.exports.addUser = Joi.object({
    name: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    userName: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional(),
    teachingDetails: Joi.object().optional(),
    countryISOCode: Joi.string().optional(),
    gender: Joi.string().optional(),
    age: Joi.string().optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    shortBio: Joi.string().optional(),
    tutorStatus: Joi.number().optional(),
    address: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
}).with('phoneNo', 'dialCode');

module.exports.updateUser = Joi.object({
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    userName: Joi.string().optional(),
    countryISOCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    name: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    gender: Joi.string().optional(),
    age: Joi.string().optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    shortBio: Joi.string().optional(),
    tutorStatus: Joi.string().optional(),
    isBlocked: Joi.boolean().optional(),
    address: Joi.string().optional(),
    ids : Joi.array().optional(),
    status : Joi.string().optional(),
    documentVerification: Joi.boolean().optional(),
    deletedAt: Joi.date().optional(),
    statusUpdatedAt: Joi.date().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    rejectReason: Joi.string().optional()
}).with('phoneNo', 'dialCode');

module.exports.addSubAdmin = Joi.object({
    email: Joi.string().optional(),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    password: Joi.string().optional(),
    name: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    permission: Joi.array().required()
}).with('phoneNo', 'dialCode');

module.exports.updateSubAdmin = Joi.object({
    email: Joi.string().optional(),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    name: Joi.string().optional(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    permission: Joi.array().required(),
    isBlocked: Joi.boolean().optional()
}).with('phoneNo', 'dialCode');

module.exports.addTeachingDetails = Joi.object({
    tutorId: Joi.objectId().required(),
    totalTeachingExperience: Joi.number().required(),
    curriculum: Joi.array().required(),
    curriculumOther: Joi.string().optional().allow(""),
    classes: Joi.array().required(),
    teachingStyle:  Joi.array().required(),
    educationLevel: Joi.number().optional(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    teachingOption: Joi.number().optional(),
    categoryId: Joi.array().optional(),
    subjectIds: Joi.array().optional(),
    price: Joi.number().required(),
    profileCompletedAt: Joi.number().optional(),
    teachingLanguage: Joi.number().optional(),
    country: Joi.string().optional(),
    usdPrice: Joi.number().optional(),
    specialization: Joi.string().optional(),
    achievement: Joi.string().optional(),
    higherEdu: Joi.number().optional(),
    otherClass: Joi.string().optional()
});

module.exports.updateTeachingDetails = Joi.object({
    tutorId: Joi.objectId().optional(),
    totalTeachingExperience: Joi.number().optional(),
    curriculum: Joi.number().optional(),
    classes: Joi.array().optional(),
    teachingStyle:  Joi.number().optional(),
    educationLevel: Joi.number().optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    teachingOption: Joi.number().optional(),
    subject: Joi.array().optional(),
    price: Joi.number().optional(),
    profileCompletedAt: Joi.number().optional(),
    teachingLanguage: Joi.number().optional(),
    specialization: Joi.string().optional(),
    achievement: Joi.string().optional(),
    higherEdu: Joi.number().optional(),
    otherClass: Joi.string().optional()
});

module.exports.addBankDetails = Joi.object({
    tutorId: Joi.objectId().required(),
    accountNumber: Joi.string().required(),
    swiftCode: Joi.string().required(),
    bankName: Joi.string().required(),
    accountHolderName: Joi.string().required(),
    country: Joi.string().optional(),
    bankAddress: Joi.string().optional()
});

module.exports.updateBankDetails = Joi.object({
    accountNumber: Joi.string().optional(),
    swiftCode: Joi.string().optional(),
    bankName: Joi.string().optional(),
    accountHolderName: Joi.string().optional(),
    profileCompletedAt: Joi.number().optional(),
    tutorId: Joi.objectId().optional(),
    country: Joi.string().optional(),
    bankAddress: Joi.string().optional()
});

module.exports.addDocuments = Joi.object({
    eduDocs: Joi.number().optional(),
    tutorId: Joi.objectId().required(),
    frontImage: Joi.string().optional().allow(""),
    backImage: Joi.string().optional().allow(""),
    description:  Joi.string().optional(),
    documentType: Joi.number().required(),
    documentName: Joi.number().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    institutionName: Joi.string().optional(),
    fieldOfStudy: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
});

module.exports.updateDocuments = Joi.object({
    eduDocs: Joi.number().optional(),
    frontImage: Joi.string().optional().allow(""),
    backImage: Joi.string().optional().allow(""),
    description:  Joi.string().optional(),
    documentType: Joi.number().optional(),
    documentName: Joi.number().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    institutionName: Joi.string().optional(),
    onGoing: Joi.boolean().optional(),
    fieldOfStudy: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
});

module.exports.rejectDocument = Joi.object({
    rejectionReason: Joi.string().optional().allow("")
});

module.exports.updateWithdrawStatus = Joi.object({
    status: Joi.string().required(),
    ids: Joi.array().required()
});

module.exports.revertQuery = Joi.object({
    revertQuery: Joi.string().required()
});

module.exports.addNotification = Joi.object({
    message: Joi.string().optional(),
    title: Joi.string().optional(),
    role: Joi.number().optional()
});

module.exports.setting = Joi.object({
    distanceType: Joi.number().optional(),
    distanceAmount: Joi.number().optional(),
    serviceType: Joi.number().optional(),
    serviceFees: Joi.number().optional(),
    currency: Joi.string().optional(),
    countryCode: Joi.string().optional()
});

module.exports.addPromoCode = Joi.object({
    tutorId: Joi.objectId().optional(),
    name: Joi.string().optional(),
    codeName: Joi.string().optional(),
    discountType: Joi.number().optional(),
    discount: Joi.number().optional(),
    maxUser: Joi.number().optional(),
    expiryDate: Joi.date().optional(),
    startDate: Joi.date().optional(),
    type: Joi.number().optional(),
    setting: Joi.number().optional(),
    allClasses: Joi.boolean().optional(),
    classIds: Joi.array().optional()
});

module.exports.updatePromoCode = Joi.object({
    tutorId: Joi.objectId().optional(),
    name: Joi.string().optional(),
    codeName: Joi.string().optional(),
    discountType: Joi.number().optional(),
    discount: Joi.number().optional(),
    expiryDate: Joi.date().optional(),
    startDate: Joi.date().optional(),
    type: Joi.number().optional(),
    setting: Joi.number().optional(),
    allClasses: Joi.boolean().optional(),
    classIds: Joi.array().optional(),
    status: Joi.boolean().optional(),
    maxUser: Joi.number().optional()
});

module.exports.inquiryRevert = Joi.object({
    inquiryId: Joi.objectId().required(),
    type: Joi.number().optional(),
    revert: Joi.string().optional(),
    tutorRevert: Joi.string().optional()
});

module.exports.addBanner = Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    image: Joi.string().optional(),
    buttonText: Joi.string().optional(),
    status: Joi.boolean().optional()
});

module.exports.addCategory = Joi.object({
    name: Joi.string().optional(),
    status: Joi.boolean().optional()
});

module.exports.addSubject = Joi.object({
    categoryId: Joi.objectId().optional(),
    name: Joi.string().optional(),
    status: Joi.boolean().optional()
});

module.exports.contentRevert = Joi.object({
    reportId: Joi.objectId().required(),
    revert: Joi.string().optional()
});


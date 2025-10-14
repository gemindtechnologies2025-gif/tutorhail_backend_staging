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

module.exports.login = Joi.object({
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    password: Joi.string().optional(),
    deviceDetails: Joi.array().optional(),
    countryISOCode: Joi.string().optional()
}).with('phoneNo', 'dialCode');

module.exports.verifyOTP = Joi.object({
    otp: Joi.number().required(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    type: Joi.number().required(),
    countryISOCode: Joi.string().optional(),
    deviceDetails: Joi.array().optional()
});

module.exports.updateProfile = Joi.object({
    name: Joi.string().optional(),
    gender: Joi.string().optional(),
    address: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    isProfileComplete: Joi.boolean().optional(),
    countryISOCode: Joi.string().optional(),
    profileCompletedAt: Joi.number().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    secondaryRole: Joi.number().optional()
});

module.exports.addAddress = Joi.object({
    longitude: Joi.number().optional(),
    latitude: Joi.number().optional(),
    houseNumber: Joi.string().optional(),
    landMark: Joi.string().optional(),
    streetAddress: Joi.string().optional(),
    city: Joi.string().optional(),
    country: Joi.string().optional(),
    location: Joi.string().optional(),
    addressType: Joi.number().optional()
});

module.exports.addBooking = Joi.object({
    tutorId: Joi.objectId().required(),
    subjectId: Joi.array().required(),
    classId: Joi.number().required(),
    parentAddressId: Joi.objectId().optional(),
    timeSlots: Joi.array().required(),
    longitude: Joi.number().optional(),
    latitude: Joi.number().optional(),
    additionalInfo: Joi.string().optional(),
    distance: Joi.number().required(),
    learnToday: Joi.string().optional(),
    currency: Joi.string().optional(),
    classModeOnline: Joi.boolean().optional(),
    promocodeId: Joi.objectId().optional()
});
 
module.exports.addRating = Joi.object({
    bookingId: Joi.objectId().required(),
    tutorId: Joi.objectId().required(),
    rating: Joi.number().optional(),
    review: Joi.string().optional().allow(""),
    ratingType: Joi.number().optional(),
    classId: Joi.objectId().optional(),
    type: Joi.number().optional()
});

module.exports.callToken = Joi.object({
    channelName: Joi.objectId().required()
});

module.exports.leaveCall = Joi.object({
    bookingId: Joi.objectId().required(),
    bookingDetailId: Joi.objectId().required()
});

module.exports.filterTutor = Joi.object({
    teachingStyle: Joi.array().optional(),
    documentVerification: Joi.boolean().optional(),
    teachingLanguage: Joi.number().optional(),
    curriculum: Joi.array().optional(),
    classes: Joi.array().optional(),
    subjects: Joi.array().optional(),
    gender: Joi.string().optional(),
    totalTeachingExperience: Joi.number().optional(),
    startPrice: Joi.number().optional(),
    endPrice: Joi.number().optional(),
    longitude: Joi.number().optional(),
    latitude: Joi.number().optional(),
    avgRating: Joi.number().optional(),
    sortBy: Joi.string().optional().allow(""),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    search: Joi.string().optional()
});

module.exports.addWishlist = Joi.object({
    tutorId: Joi.objectId().required()
});

module.exports.classBooking = Joi.object({
    bookClassId: Joi.objectId().required(),
    classSlotIds: Joi.array().required(),
    promocodeId: Joi.objectId().optional(),
    bookFor: Joi.number().required(),
    slotType: Joi.number().required(),
    name: Joi.string().optional(),
    email: Joi.string().optional(),
    classModeOnline: Joi.boolean().required()
});

module.exports.engage = Joi.object({
    contentId: Joi.objectId().required(),
    engagementType: Joi.number().required(),
    commentText: Joi.string().optional(),
    image: Joi.string().optional(),
    amount: Joi.number().optional(),
    note: Joi.string().optional(),
    duration: Joi.number().optional(),
    durationType: Joi.number().optional()
});
 
module.exports.commentEngage = Joi.object({
    type: Joi.number().required(),
    commentId: Joi.objectId().required(),
    reply: Joi.string().optional(),
    image: Joi.string().optional()
});

module.exports.follow = Joi.object({
    tutorId: Joi.objectId().required()
});

module.exports.addInquiry = Joi.object({
    tutorId: Joi.objectId().required(),
    type: Joi.number().required(),
    other: Joi.string().optional(),
    name: Joi.string().optional(),
    email: Joi.string().optional()
});

module.exports.saveClass = Joi.object({
    classId: Joi.objectId().required()
});

module.exports.reportContent = Joi.object({
    contentId: Joi.objectId().optional(),
    tutorId: Joi.objectId().optional(),
    classId: Joi.objectId().optional(),
    report: Joi.number().optional(),
    reason: Joi.string().optional()
});

module.exports.blockChat = Joi.object({
    chatId: Joi.string().required(),
    tutorId: Joi.objectId().optional(),
    parentId: Joi.objectId().optional(),
    report: Joi.number().optional(),
    screenshot: Joi.string().optional(),
    details: Joi.string().optional(),
    type: Joi.number().required()
});
module.exports.agreeChat = Joi.object({
    chatId: Joi.string().required()
});
module.exports.pollVote = Joi.object({
    pollOptionId:  Joi.objectId().required(),
    contentId:  Joi.objectId().required()
});

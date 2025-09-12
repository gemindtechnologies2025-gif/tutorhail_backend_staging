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
    secondaryRole: Joi.number().optional(),
    userName: Joi.string().optional(),
    gender: Joi.string().optional(),
    age: Joi.string().optional(),
    shortBio: Joi.string().optional(),
    address: Joi.string().optional(),
    image: Joi.string().optional().allow(""),
    isProfileComplete: Joi.boolean().optional(),
    countryISOCode: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    isActive: Joi.boolean().optional(),
    profileCompletedAt: Joi.number().optional(),
    bannerImg: Joi.string().optional()
});

module.exports.addBankDetails = Joi.object({
    accountNumber: Joi.string().optional(),
    swiftCode: Joi.string().optional(),
    bankName: Joi.string().optional(),
    accountHolderName: Joi.string().optional(),
    profileCompletedAt: Joi.number().optional(),
    country: Joi.string().optional(),
    bankAddress: Joi.string().optional()
});

module.exports.addTeachingDetails = Joi.object({
    totalTeachingExperience: Joi.number().optional(),
    startTime: Joi.date().optional(),
    endTime: Joi.date().optional(),
    teachingLanguage: Joi.number().optional(),
    teachingStyle: Joi.array().optional(),
    curriculum: Joi.array().optional(),
    curriculumOther: Joi.string().optional().allow(""),
    price: Joi.number().optional(),
    classes: Joi.array().optional(),
    categoryId: Joi.array().optional(),
    subjectIds: Joi.array().optional(),
    profileCompletedAt: Joi.number().optional(),
    specialization: Joi.string().optional(),
    achievement: Joi.string().optional(),
    higherEdu: Joi.number().optional(),
    otherClass: Joi.string().optional(),
    country: Joi.string().optional(),
    usdPrice: Joi.number().optional()
});

module.exports.addDocuments = Joi.object({
    tutorId: Joi.objectId().optional(),
    documents: Joi.array({
        eduDocs: Joi.number().optional(),
        documentType: Joi.number().required(),
        documentName: Joi.number().optional(),
        frontImage: Joi.string().optional(),
        backImage: Joi.string().optional(),
        description: Joi.string().optional(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        institutionName: Joi.string().optional(),
        fieldOfStudy: Joi.string().optional(),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional(),
        onGoing: Joi.boolean().optional()
    })
});

module.exports.updateDocuments = Joi.object({
    documentType: Joi.number().required(),
    documentName: Joi.number().optional(),
    frontImage: Joi.string().optional(),
    backImage: Joi.string().optional(),
    description: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    institutionName: Joi.string().optional(),
    fieldOfStudy: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    onGoing: Joi.boolean().optional(),
    eduDocs: Joi.number().optional()
});

module.exports.contentMaterial = Joi.object({
    bookingId: Joi.objectId().optional(),
    parentId: Joi.objectId().optional(),
    bookingDetailId: Joi.objectId().optional(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    content: Joi.string().optional()
});

module.exports.withdraw = Joi.object({
    withdraw: Joi.number().required(),
    withdrawMode: Joi.number().required()
});

module.exports.callToken = Joi.object({
    bookingDetailId: Joi.objectId().required()
});

module.exports.pairingOtp = Joi.object({
    bookingId: Joi.objectId().required(),
    bookingDetailId: Joi.objectId().required(),
    pairingType: Joi.number().optional()
});

module.exports.verifyPairingOtp = Joi.object({
    bookingId: Joi.objectId().required(),
    bookingDetailId: Joi.objectId().required(),
    pairingType: Joi.number().optional(),
    otp: Joi.number().optional()
});

module.exports.updateBooking = Joi.object({
    bookingStatus: Joi.number().optional(),
    cancelReason: Joi.string().optional()
});

module.exports.support = Joi.object({
    supportType: Joi.number().optional(),
    title: Joi.string().optional(),
    query: Joi.string().optional()
});

module.exports.addClass = Joi.object({
    tutorId: Joi.objectId().optional(),
    subjectId: Joi.objectId().optional(),
    grades: Joi.array().optional(),
    topic: Joi.string().optional(),
    description: Joi.string().optional(),
    objective: Joi.string().optional(),
    allOutcome: Joi.string().optional(),
    mostOutcome: Joi.string().optional(),
    someOutcome: Joi.string().optional(),
    thumbnail: Joi.string().optional(),
    teaser: Joi.string().optional(),
    classSlots: Joi.array({
        date: Joi.date().optional(),
        startTime: Joi.date().optional(),
        endTime: Joi.date().optional()
    }).optional(),
    fees: Joi.number().optional(),
    promoCodeId: Joi.array().optional(),
    seats: Joi.number().optional(),
    coTutorId: Joi.array().optional(),
    material: Joi.array().optional(),
    searchTags: Joi.array().optional(),
    language: Joi.number().optional(),
    notes: Joi.string().optional(),
    classMode: Joi.number().optional(),
    timezone:  Joi.string().optional(),
    canBePrivate: Joi.boolean().optional(),
    setting: Joi.number().optional(),
    address: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    selectedSlots: Joi.array().optional(),
    isFreeLesson: Joi.boolean().optional(),
    typeOfClass: Joi.number().optional(),
    payment: Joi.number().optional(),
    duration: Joi.number().optional(),
    repeatEvery: Joi.number().optional(),
    continueFor: Joi.number().optional(),
    currency: Joi.string().optional(),
    usdPrice: Joi.number().optional()
});

module.exports.updateClass = Joi.object({
    subjectId: Joi.objectId().optional(),
    grades: Joi.array().optional(),
    topic: Joi.string().optional(),
    description: Joi.string().optional(),
    objective: Joi.string().optional(),
    allOutcome: Joi.string().optional(),
    mostOutcome: Joi.string().optional(),
    someOutcome: Joi.string().optional(),
    thumbnail: Joi.string().optional(),
    teaser: Joi.string().optional(),
    classSlots: Joi.array({
        date: Joi.date().optional(),
        startTime: Joi.date().optional(),
        endTime: Joi.date().optional()
    }).optional(),
    fees: Joi.number().optional(),
    promoCodeId: Joi.array().optional(),
    seats: Joi.number().optional(),
    coTutorId: Joi.array().optional(),
    material: Joi.array().optional(),
    searchTags: Joi.array().optional(),
    language: Joi.number().optional(),
    notes: Joi.string().optional(),
    classMode: Joi.number().optional(),
    timezone:  Joi.string().optional(),
    canBePrivate:  Joi.boolean().optional(),
    setting: Joi.number().optional(),
    status: Joi.boolean().optional(),
    address: Joi.string().optional(),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    selectedSlots: Joi.array().optional(),
    isFreeLesson: Joi.boolean().optional(),
    typeOfClass: Joi.number().optional(),
    payment: Joi.number().optional(),
    duration: Joi.number().optional(),
    repeatEvery: Joi.number().optional(),
    continueFor: Joi.number().optional(),
    currency: Joi.string().optional(),
    addSeats: Joi.number().optional(),
    usdPrice: Joi.number().optional()
});

module.exports.addContent = Joi.object({
    userId: Joi.objectId().optional(),
    categoryId: Joi.objectId().optional(),
    subjectId: Joi.array().optional(),
    classId: Joi.number().optional(),
    images: Joi.array().optional(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    contentType: Joi.number().required(),
    gradeId: Joi.number().optional(),
    topic: Joi.string().optional(),
    language: Joi.number().optional(),
    allowComments: Joi.boolean().optional(),
    visibility: Joi.number().optional(),
    isAnonymous: Joi.boolean().optional(),
    uploadType: Joi.number().optional(),
    setting: Joi.number().optional(),
    question: Joi.string().optional(),
    options: Joi.array().optional(),
    duration: Joi.number().optional()
});

module.exports.updateContent = Joi.object({
    ids: Joi.array().optional(),
    categoryId: Joi.objectId().optional(),
    subjectId: Joi.array().optional(),
    classId: Joi.number().optional(),
    images: Joi.array().optional(),
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    status: Joi.boolean().optional(),
    type: Joi.number().optional(),
    contentType: Joi.number().optional(),
    gradeId: Joi.number().optional(),
    topic: Joi.string().optional(),
    language: Joi.number().optional(),
    allowComments:  Joi.boolean().optional(),
    visibility: Joi.number().optional(),
    setting: Joi.number().optional(),
    isAnonymous: Joi.boolean().optional(),
    uploadType: Joi.number().optional(),
    question: Joi.string().optional(),
    durationType: Joi.number().optional()
});

module.exports.addSocialLinks = Joi.object({
    type: Joi.number().optional(),
    link: Joi.string().required()
});

module.exports.updateSlotStatus = Joi.object({
    slotIds: Joi.array().required(),
    status: Joi.boolean().required()
});

module.exports.coTutorStatus = Joi.object({
    classId: Joi.objectId().required(),
    status: Joi.number().required()
});
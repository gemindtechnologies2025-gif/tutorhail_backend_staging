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

module.exports.socialLogin = Joi.object({
    appleId: Joi.string().optional().allow(""),
    googleId: Joi.string().optional().allow(""),
    linkedInId: Joi.string().optional().allow(""),
    microsoftId: Joi.string().optional().allow(""),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    deviceToken: Joi.string().optional(),
    deviceType: Joi.string().optional(),
    deviceDetails: Joi.array().optional(),
    name: Joi.string().optional(),
    image: Joi.string().optional()
});

module.exports.signup = Joi.object({
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    password: Joi.string().optional(),
    countryISOCode: Joi.string().optional(),
    timezone: Joi.string().optional()
}).with('phoneNo', 'dialCode');

module.exports.login = Joi.object({
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    password: Joi.string().optional(),
    deviceType: Joi.string().optional(),
    deviceToken: Joi.string().optional(),
    deviceDetails: Joi.array().optional(),
    countryISOCode: Joi.string().optional()
}).with('phoneNo', 'dialCode');

module.exports.validateSendOtp = Joi.object({
    key: Joi.string().required(),
    role: Joi.string().optional(),
    email: Joi.string().optional(),
    hash: Joi.string().optional(),
    sek: Joi.string().optional(),
    appKey: Joi.string().optional(),
    dialCode: Joi.string().allow("", null).optional(),
    password: Joi.string().allow("", null).optional(),
    countryISOCode: Joi.string().optional()
});

module.exports.resetPassword = Joi.object({
    newPassword: Joi.string().required()
});

module.exports.changePassword = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required()
});

module.exports.sendOTP = Joi.object({
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    isForget: Joi.boolean().optional(),
    type: Joi.number().required(),
    countryISOCode: Joi.string().optional()
});

module.exports.verifyOTP = Joi.object({
    otp: Joi.number().required(),
    email: Joi.string().email().optional().error(new Error("Please Enter a valid email")),
    phoneNo: Joi.string().optional(),
    dialCode: Joi.string().optional(),
    type: Joi.number().required(),
    countryISOCode: Joi.string().optional(),
    deviceType: Joi.string().optional(),
    deviceToken: Joi.string().optional(),
    deviceDetails: Joi.array().optional()
});

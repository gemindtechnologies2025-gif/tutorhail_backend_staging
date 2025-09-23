const Model = require("../../../models/index");
const Validation = require("../../validations");
const Auth = require("../../../common/authenticate");
const constants = require("../../../common/constants");
const services = require("../../../services/index");
const functions = require("../../../common/functions");
const common = require('../../../services/common');
const cart = require('../PaymentController/pesapalPayment');
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const moment = require('moment');
const axios = require('axios');

//Social login using google, facebook and apple.
module.exports.socialLogin = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.socialLogin.validateAsync(req.body);
    const socials = [];
    if (req.body.appleId) {
      socials.push({
        appleId: req.body.appleId
      });
    }
    if (req.body.googleId) {
      socials.push({
        googleId: req.body.googleId
      });
    }
    if (req.body.linkedInId) {
      socials.push({
        linkedInId: req.body.linkedInId
      });
    }
    if (req.body.microsoftId) {
      socials.push({
        microsoftId: req.body.microsoftId
      });
    }
    if (!socials.length) throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    //check if user has already created an account with the social Id's.
    let user = await Model.User.findOne({
      $or: socials,
      isDeleted: false
    });
    let successMessage = 1;
    if (req.body.phoneNo) {
      user = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isDeleted: false
      });
    }
    if (req.body.email) {
      user = await Model.User.findOne({
        email: req.body.email.toLowerCase(),
        isDeleted: false
      });
    }
    //If no account is created, Craete a new account.
    if (user == null || user == undefined) {
      req.body.isSocialLogin = true;
      user = await Model.User.create(req.body);
      successMessage = 2;
    }
    //Check for the dummy email used by apple if user has hidden his/her email.
    if (user.email) {
      if (
        req.body.email &&
        !req.body.email.includes("privaterelay.appleid.com")
      ) {
        if (req.body.email) {
          user.email = req.body.email;
        }
      }
      user.isEmailVerified = true;
    }
    if (user.phoneNo) {
      user.isPhoneVerified = true;
    }
     let sessionId = functions.generateRandomCustom(6);
     if (req.body.deviceDetails) {
      req.body.deviceDetails.forEach((device) => {
        if (
          !user.deviceDetails.some((d) => d.deviceToken === device.deviceToken)
        ) {
          user.deviceDetails.push({
            deviceToken: device.deviceToken,
            deviceType: device.deviceType,
            sessionId: sessionId
          });
        }
      });
    }
    user.loginCount += 1;
    user.role = constants.APP_ROLE.TUTOR;
    //Create a JTI for secure login using JWT.
    user.jti = functions.generateRandomCustom(25);

    await user.save();
    user = JSON.parse(JSON.stringify(user));
    //Issue an unique access token to ensure single login.
    user.accessToken = await Auth.getToken({
      _id: user._id,
      role: constants.ROLE.TUTOR,
      jti: user.jti,
      sessionId: sessionId
    });
    return res.success(
      successMessage == 1 ?
      constants.MESSAGES[lang].LOGIN_SUCCESS :
      constants.MESSAGES[lang].ACCOUNT_CREATED_SUCCESSFULLY,
      user
    );
  } catch (error) {
    next(error);
  }
};
//Signup the user using phoneNo/Email.
module.exports.signup = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.signup.validateAsync(req.body);
    //Check if the phoneNo/email is already used in an account.
    if (req.body.phoneNo) {
      let checkPhone = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isPhoneVerified: true,
        isDeleted: false
      });
      if (checkPhone) {
        throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
      } else {
        await Model.User.deleteMany({
          dialCode: req.body.dialCode,
          phoneNo: req.body.phoneNo,
          isPhoneVerified: false,
          isDeleted: false
        });
      }
    }
    if (req.body.email) {
      let checkEmail = await Model.User.findOne({
        email: req.body.email.toLowerCase(),
        isEmailVerified: true,
        isDeleted: false
      });
      if (checkEmail) {
        throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
      } else {
        await Model.User.deleteMany({
          email: req.body.email.toLowerCase(),
          isEmailVerified: false,
          isDeleted: false
        });
      }
    }
    //req.body.profileCompletedAt = constants.PROFILE_STATUS.DEFAULT;
    req.body.role = constants.APP_ROLE.TUTOR;
    req.body.secondaryRole = constants.APP_ROLE.TUTOR;
    let dataToSave = req.body;
    //Create a user and check using which verification method user wants to very his/her account.
    let user = await Model.User.create(dataToSave);

    //Send verification code using Sms service or Email service.
    if (req.body.email) {
      let payload = {
        email: req.body.email.toLowerCase(),
        name: req.body.firstName ? req.body.firstName : req.body.email,
        type: constants.VERIFICATION_TYPE.SIGNUP
      };
      services.EmalService.sendEmailVerificationTutor(payload);
    } else if (req.body.phoneNo) {
      let payload = {
        dialCode: user.dialCode,
        phoneNo: user.phoneNo,
        type: constants.VERIFICATION_TYPE.SIGNUP
      };
      services.SmsService.sendPhoneVerification(payload);
    }
    //Decode the password using Bcrypt to ensure secure login.
    if (req.body.password) {
      user.isPasswordSet = true;
      await user.setPassword(req.body.password);
    }
    await user.save();
    user = JSON.parse(JSON.stringify(user));
    delete user.password;

    return res.success(constants.MESSAGES[lang].ACCOUNT_CREATED_SUCCESSFULLY, user);
  } catch (error) {
    next(error);
  }
};
//Login the user using phoneNo/Email.
module.exports.login = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.login.validateAsync(req.body);
    let user;
    if (req.body.email) {
      user = await Model.User.findOne({
        email: req.body.email.toLowerCase(),
        role: constants.APP_ROLE.TUTOR,
        isDeleted: false
      });
      if (!user) {
        throw new Error(constants.MESSAGES[lang].USER_NOT_FOUND);
      }
      if (user) {
        await user.authenticate(req.body.password);
      }
    } else if (req.body.phoneNo) {
      user = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        role: constants.APP_ROLE.TUTOR,
        isDeleted: false
      });
      if (!user) {
        throw new Error(constants.MESSAGES[lang].USER_NOT_FOUND);
      }
      if (user.tutorStatus == constants.TUTOR_STATUS.REJECTED) {
        throw new Error(constants.MESSAGES[lang].TUTOR_REJECTED);
      }

      if (user) {
        if (user.isBlocked) throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
        let payload = {
          phoneNo: user.phoneNo,
          dialCode: user.dialCode,
          type: constants.VERIFICATION_TYPE.LOGIN
        };
        await services.SmsService.sendPhoneVerification(payload);
        return res.success(constants.MESSAGES[lang].VERIFICATION_CODE_SEND);
      }
    }
    if (!user) throw new Error(constants.MESSAGES[lang].INVALID_CREDENTIALS);
    if (user.isBlocked) throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);

    if (req.body.email) {
      if (user.tutorStatus == constants.TUTOR_STATUS.REJECTED) {
        throw new Error(constants.MESSAGES[lang].TUTOR_REJECTED);
      }
    }
    user.loginCount += 1;
    user.secondaryRole = constants.APP_ROLE.TUTOR;
    let sessionId = functions.generateRandomCustom(6);
    if (req.body.deviceDetails) {
      req.body.deviceDetails.forEach((device) => {
      if (
        !user.deviceDetails.some((d) => d.deviceToken === device.deviceToken)
      ) {
        user.deviceDetails.push({
        deviceToken: device.deviceToken,
        deviceType: device.deviceType,
        sessionId: sessionId
        });
      }
    });
    }
    //Re create a new JTI for JWT to ensure single login.
    user.jti = functions.generateRandomCustom(25);
    await user.save();
    user = JSON.parse(JSON.stringify(user));
    user.accessToken = await Auth.getToken({
      _id: user._id,
      role: constants.ROLE.TUTOR,
      jti: user.jti,
      sessionId: sessionId
    });
    if (user.password) {
      delete user.password;
    }
    return res.success(constants.MESSAGES[lang].LOGIN_SUCCESS, user);
  } catch (error) {
    next(error);
  }
};
//Logout the current user and change the JTI, Also remove the current device type and device token.
module.exports.logout = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    const sessionId = req.user.deviceDetails?.find(
      (detail) => detail.sessionId
    )?.sessionId;

    if (!sessionId) {
      return res.success(constants.MESSAGES[lang].LOGOUT_SUCCESS);
    }

    await Model.User.updateOne(
      { _id: req.user._id, isDeleted: false },
      { $pull: { deviceDetails: { sessionId } } }
    );

    const updatedUser = await Model.User.findOne(
      { _id: req.user._id },
      { deviceDetails: 1, role: 1 }
    );

    if (
      updatedUser &&
      (!updatedUser.deviceDetails || updatedUser.deviceDetails.length === 0)
    ) {
      await Model.User.updateOne(
        { _id: req.user._id },
        { $set: { isActive: false } }
      );
    }

    return res.success(constants.MESSAGES[lang].LOGOUT_SUCCESS);
  } catch (error) {
    next(error);
  }
};

//Get the complete profile of the current user.
module.exports.getProfile = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let doc = await Model.User.findOne(
      {
        _id: req.user._id,
        isDeleted: false
      },
      { password: 0 }
    ).lean();
    if (!doc) {
      return res.success(constants.MESSAGES[lang].DATA_NOT_FOUND, {});
    }
    const notificationUnreadCount = await Model.Notification.countDocuments({
      tutorId: req.user._id,
      role: constants.ROLE.TUTOR,
      isRead: false
    });
    const chatUnreadCount = await Model.ChatMessage.countDocuments({
      tutorId: req.user._id,
      sentBy: constants.APP_ROLE.PARENT,
      isTutorRead: false
    });
    doc.notificationUnreadCount = notificationUnreadCount;
    doc.chatUnreadCount = chatUnreadCount;

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, doc);
  } catch (error) {
    next(error);
  }
};
//Delete the profile of the current user.
module.exports.deleteProfile = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    // Check if the account exists
    const existingAccount = await Model.User.findById(req.user._id);
    if (!existingAccount) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    }

    const findBooking = await Model.Booking.findOne({
      tutorId: ObjectId(req.user._id),
      isDeleted: false,
      bookingStatus: {
        $in: [constants.BOOKING_STATUS.ACCEPTED, constants.BOOKING_STATUS.ONGOING]
      }
    });

    if (findBooking) {
      throw new Error(constants.MESSAGES[lang].TUTOR_BOOKING_EXIST);
    }

    await Model.User.findOneAndUpdate({
      _id: req.user._id
    }, {
      $set: {
        isDeleted: true,
        deletedAt: new Date()
      }
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].ACCOUNT_DELETED);
  } catch (error) {
    next(error);
  }
};
//Update the user details.
module.exports.updateProfile = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateProfile.validateAsync(req.body);
    const nin = {
      $nin: [req.user._id]
    };
    if (req.body.phoneNo) {
      let checkPhone = await Model.User.findOne({
        _id: nin,
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isDeleted: false
      });
      if (checkPhone) {
        throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
      } else {
        checkPhone = await Model.User.findOne({
          _id: req.user._id,
          dialCode: req.body.dialCode,
          phoneNo: req.body.phoneNo,
          isDeleted: false,
          isPhoneVerified: true
        });
        if (checkPhone == null) {
          req.body.isPhoneVerified = false;
          let dataToSend = {
            phoneNo: req.body.phoneNo,
            dialCode: req.body.dialCode
          };
          services.SmsService.sendPhoneVerification(dataToSend);
        }
      }
    }
    if (req.body.email) {
      let checkEmail = await Model.User.findOne({
        _id: nin,
        email: req.body.email.toLowerCase(),
        isEmailVerified: true,
        isDeleted: false
      });
      if (checkEmail) {
        throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
      } else {
        checkEmail = await Model.User.findOne({
          _id: req.user._id,
          email: req.body.email.toLowerCase(),
          isDeleted: false,
          isEmailVerified: true
        });
        if (checkEmail == null) {
          req.body.isEmailVerified = false;
          let dataToSend = {
            email: req.body.email.toLowerCase(),
            name: checkEmail ? checkEmail.firstName : req.body.email
          };
          services.EmalService.sendEmailVerificationTutor(dataToSend);
        }
      }
    }
    if (req.body.image == "") {
      delete req.body.image;
    }
    //If user tries to remove the password them delete the password key.
    if (req.body.password == "" || req.body.password == null) {
      delete req.body.password;
    }
    const userData = await Model.User.findOne({
      _id: req.user._id,
      isDeleted: false
    });
    if (userData == null) throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    if (userData.isEmailVerified == true && req.body.email == "") {
      delete req.body.email;
    }
    if (userData.isPhoneVerified == true && req.body.phoneNo == "") {
      delete req.body.phoneNo;
      delete req.body.dialCode;
    }
    if (req.body.dialCode && !req.body.dialCode.includes("+")) {
      req.body.dialCode = "+" + req.body.dialCode;
    }
    req.body.isProfileComplete = true;

    if (userData.profileCompletedAt == constants.PROFILE_STATUS.DEFAULT) {
      req.body.profileCompletedAt = constants.PROFILE_STATUS.PROFILE_SETUP;
    }

    let updated = await Model.User.findOneAndUpdate({
      _id: req.user._id,
      isDeleted: false
    }, {
      $set: req.body
    }, {
      new: true
    });

    if (updated && userData.isProfileComplete == false) {
      process.emit("sendNotification", {
        tutorId: updated._id,
        receiverId: updated._id,
        values: updated,
        role: constants.ROLE.TUTOR,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.REGISTER
      });
    }
    let admin = await Model.Admin.findOne({
      isDeleted: false
    });
    if (updated && userData.isProfileComplete == false) {
      process.emit("sendNotification", {
        adminId: admin._id,
        receiverId: admin._id,
        values: updated,
        role: constants.ROLE.ADMIN,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.TUTOR_REGISTER
      });
    }

    return res.success(
      constants.MESSAGES[lang].PROFILE_UPDATED_SUCCESSFULLY,
      updated
    );
  } catch (error) {
    next(error);
  }
};
//Reset password in case of forgot.
module.exports.resetPassword = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.resetPassword.validateAsync(req.body);
    const doc = await Model.User.findOne({
      _id: req.user._id
    });
    if (!doc) throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    await doc.setPassword(req.body.newPassword);
    await doc.save();
    return res.success(constants.MESSAGES[lang].PASSWORD_RESET);
  } catch (error) {
    next(error);
  }
};
//Change the old password with the new one.
module.exports.changePassword = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.changePassword.validateAsync(req.body);
    if (req.body.oldPassword == req.body.newPassword)
      throw new Error(constants.MESSAGES[lang].PASSWORDS_SHOULD_BE_DIFFERENT);

    const doc = await Model.User.findOne({
      _id: req.user._id
    });
    if (!doc) throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);

    await doc.authenticate(req.body.oldPassword);
    await doc.setPassword(req.body.newPassword);
    await doc.save();

    return res.success(constants.MESSAGES[lang].PASSWORD_CHANGED_SUCCESSFULLY);
  } catch (error) {
    next(error);
  }
};
//Otp
module.exports.sendOtp = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.sendOTP.validateAsync(req.body);
    //Send Otp in case of forgot password.
    if (Boolean(req.body.isForget) == true) {
      if (req.body.phoneNo) {
        let dataToSend = {
          phoneNo: req.body.phoneNo,
          dialCode: req.body.dialCode,
          isDeleted: false
        };
        let check = await Model.User.findOne(dataToSend);
        if (check == null)
          throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
        dataToSend.type = req.body.type;
        services.SmsService.sendPhoneVerification(dataToSend);
      }
      if (req.body.email) {
        let check = await Model.User.findOne({
          email: req.body.email.toLowerCase(),
          isEmailVerified: true,
          isDeleted: false
        });
        if (check == null)
          throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);

        let dataToSend = {
          email: req.body.email.toLowerCase(),
          name: check.firstName ? check.firstName : check.email,
          title: "Verify OTP for Forgot password",
          type: req.body.type
        };
        services.EmalService.forgotPasswordEmail(dataToSend);
      }
    }
    //Send Otp in case of verification.
    else {
      if (req.body.phoneNo) {
        if (req.user) {
          let check = await Model.User.findOne({
            phoneNo: req.body.phoneNo,
            dialCode: req.body.dialCode,
            _id: {
              $nin: [req.user._id]
            },
            isDeleted: false
          });
          if (check) {
            throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_EXISTS);
          }
        }
        let dataToSend = {
          phoneNo: req.body.phoneNo,
          dialCode: req.body.dialCode,
          type: req.body.type,
          tutorId: req.user ? req.user._id : null
        };
        services.SmsService.sendPhoneVerification(dataToSend);
      } else if (req.body.email) {
        if (req.user) {
          let check = await Model.User.findOne({
            email: req.body.email.toLowerCase(),
            isDeleted: false,
            _id: {
              $nin: [req.user._id]
            }
          });
          if (check) {
            throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_EXISTS);
          }
        }
        let dataToSend = {
          email: req.body.email.toLowerCase(),
          type: req.body.type,
          tutorId: req.user ? req.user._id : null
        };
        services.EmalService.sendEmailVerificationTutor(dataToSend);
      }
    }
    return res.success(constants.MESSAGES[lang].OTP_SENT);
  } catch (error) {
    next(error);
  }
};
//Verify the user otp with email/phoneNo.
module.exports.verifyOtp = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.verifyOTP.validateAsync(req.body);
    let data = null;
    let message;

    let verify;
    let verificationType = Number(req.body.type);
    if (req.body.dialCode && req.body.phoneNo && req.body.otp) {
      let payload = {
        phoneNo: req.body.phoneNo,
        dialCode: req.body.dialCode,
        otp: req.body.otp
      };
      verify = await services.SmsService.verifyOtp(payload);
    }
    let qry = {
      otp: req.body.otp
    };
    if (req.user) {
      qry.tutorId = req.user._id;
    }
    if (req.body.email) {
      qry.email = req.body.email.toLowerCase();
    } else {
      qry.phoneNo = req.body.phoneNo;
    }
    if (req.body.dialCode) {
      qry.dialCode = req.body.dialCode;
    }

    //Check if user has sent any otp for verification.
    if (req.body.phoneNo) {
      if (!verify) {
        throw new Error(constants.MESSAGES[lang].INVALID_OTP);
      }
    }

    let updatePayload = {};
    let otp = await Model.Otp.findOne(qry);
    if (req.body.email) {
      if (!otp) {
        throw new Error(constants.MESSAGES[lang].INVALID_OTP);
      }
      verificationType = otp.type;
      if (otp.email) {
        updatePayload.email = otp.email;
      }
    }

    if (req.user && req.user._id) {
      if (verify) {
        updatePayload.phoneNo = req.body.phoneNo;
        updatePayload.dialCode = req.body.dialCode;
      }
      data = await Model.User.findOneAndUpdate({
        _id: req.user._id,
        isDeleted: false
      }, {
        $set: updatePayload
      }, {
        new: true
      });
    }
    if (otp) await Model.Otp.findByIdAndRemove(otp._id);
    if (req.body.email) {
      data = await Model.User.findOneAndUpdate({
        email: req.body.email.toLowerCase(),
        isDeleted: false
      }, {
        $set: {
          isEmailVerified: true
        }
      }, {
        new: true
      });
    } else {
      data = await Model.User.findOneAndUpdate({
        phoneNo: req.body.phoneNo,
        dialCode: req.body.dialCode,
        isDeleted: false
      }, {
        $set: {
          isPhoneVerified: true
        }
      }, {
        new: true
      });
    }
    if (data == null) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    }
    if (verificationType == constants.VERIFICATION_TYPE.SIGNUP) {
      message = constants.MESSAGES[lang].ACCOUNT_CREATED_SUCCESSFULLY;
    }
    if (verificationType == constants.VERIFICATION_TYPE.LOGIN) {
      data.secondaryRole = constants.APP_ROLE.TUTOR;
      data.loginCount += 1;
      message = constants.MESSAGES[lang].LOGIN_SUCCESS;
    }
    if (verificationType == constants.VERIFICATION_TYPE.UPDATE) {
      message = req.body.email ?
        constants.MESSAGES[lang].EMAIL_UPDATE_SUCCESSFULLY :
        constants.MESSAGES[lang].PHONE_UPDATE_SUCCESSFULLY;
    }
    if (verificationType == constants.VERIFICATION_TYPE.FORGET) {
      message = constants.MESSAGES[lang].ACCOUNT_VERIFIED;
    }
    let sessionId = functions.generateRandomCustom(6);
    if (req.body.deviceDetails) {
      req.body.deviceDetails.forEach((device) => {
        if (
          !data.deviceDetails.some((d) => d.deviceToken === device.deviceToken)
        ) {
          data.deviceDetails.push({
            deviceToken: device.deviceToken,
            deviceType: device.deviceType,
            sessionId: sessionId
          });
        }
      });
    }
    data.jti = functions.generateRandomCustom(25);
    await data.save();
    data = JSON.parse(JSON.stringify(data));
    
    if (data == null) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    }
    if (data && data.isBlocked) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
    }

    data.accessToken = await Auth.getToken({
      _id: data._id,
      role: constants.ROLE.TUTOR,
      jti: data.jti,
      sessionId: sessionId
    });
    return res.success(message, data);
  } catch (error) {
    next(error);
  }
};

//Bank Details
module.exports.addBank = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.addBankDetails.validateAsync(req.body);
    const tutorData = await Model.User.findOne({
      _id: req.user._id
    });
    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    req.body.tutorId = req.user._id;
    let addBankDetails = await Model.BankDetails.create(req.body);

    await Model.User.findOneAndUpdate({
      _id: req.user._id,
      isDeleted: false
    }, {
      $set: {
        profileCompletedAt: constants.PROFILE_STATUS.BANK_DETAIL
      }
    }, {
      new: true
    });

    return res.success(
      constants.MESSAGES[lang].BANK_DETAIL_CREATED_SUCCESSFULLY,
      addBankDetails
    );
  } catch (error) {
    next(error);
  }
};
module.exports.getBank = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let id = req.params.id;
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    if (id == null) {
      let qry = {};
      if (req.query.search) {
        const regex = new RegExp(req.query.search, "i");
        qry._search = regex;
      }
      let pipeline = [{
          $match: {
            tutorId: req.user._id,
            isDeleted: false
          }
        },{
          $addFields: {
            _search: {
              $concat: [{
                $ifNull: ["$accountHolderName", ""]
              }, {
                $ifNull: ["$bankName", ""]
              }]
            }
          }
        },{
          $match: qry
        },{
          $sort: {
            createdAt: -1
          }
        }];

      pipeline = await common.pagination(pipeline, skip, limit);
      let [bank] = await Model.BankDetails.aggregate(pipeline);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        bank: bank.data,
        totalBank: bank.total
      });

    } else {
      let pipeline = [{
        $match: {
          _id: ObjectId(id),
          isDeleted: false
        }
      }];
      let [bank] = await Model.BankDetails.aggregate(pipeline);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, bank);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.updateBank = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.updateBankDetails.validateAsync(req.body);
    const bankData = await Model.BankDetails.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!bankData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const doc = await Model.BankDetails.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    },{
      $set: req.body
    },{
      new: true
    });
    return res.success(
      constants.MESSAGES[lang].BANk_DETAILS_UPDATED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deleteBank = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const bankData = await Model.BankDetails.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!bankData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const doc = await Model.BankDetails.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    },{
      isDeleted: true
    },{
      new: true
    });

    return res.success(
      constants.MESSAGES[lang].BANK_DETAIL_DELETED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};

//Teaching Details
module.exports.teachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let classDoc, subDoc, teachDoc;
    let upTeachDoc, upSubDoc, upClassDoc;
    await Validation.Tutor.addTeachingDetails.validateAsync(req.body);
    const tutorData = await Model.User.findOne({
      _id: req.user._id
    });

    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const existingDetail = await Model.TeachingDetails.findOne({
      tutorId: tutorData._id,
      isDeleted: false
    });
    if (req.body.startTime && req.body.endTime) {
      const startDateTime = moment.utc(req.body.startTime);
      const endDateTime = moment.utc(req.body.endTime);
      if (endDateTime.isSameOrBefore(startDateTime)) {
        throw new Error(constants.MESSAGES[lang].TIME_ERROR);
      }
    }

    if (existingDetail) {
      upTeachDoc = await Model.TeachingDetails.findOneAndUpdate({
        tutorId: existingDetail.tutorId
      },{
        $set: req.body
      },{
        new: true
      });
    } else {
      req.body.tutorId = req.user._id;
      teachDoc = await Model.TeachingDetails.create(req.body);
      await Model.User.findOneAndUpdate({
        _id: req.user._id,
        isDeleted: false
      },{
        $set: {
          profileCompletedAt: constants.PROFILE_STATUS.TEACHING_DETAIL
        }
      },{
        new: true
      });
    }
    let data = {
      classDoc,
      subDoc,
      teachDoc,
      upTeachDoc,
      upSubDoc,
      upClassDoc
    };
    return res.success(constants.MESSAGES[lang].USER_CREATED_SUCCESSFULLY, data);

  } catch (error) {
    next(error);
  }
};
module.exports.deleteTeachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const teachingData = await Model.TeachingDetails.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!teachingData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const doc = await Model.TeachingDetails.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    },{
      isDeleted: true
    },{
      new: true
    });

    return res.success(constants.MESSAGES[lang].PROFILE_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

module.exports.getTeachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          tutorId: req.user._id,
          isDeleted: false
        }
      },{
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryId"
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "subjectIds",
          foreignField: "_id",
          as: "subjectIds"
        }
      }];
    let tutor = await Model.TeachingDetails.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);

  } catch (error) {
    next(error);
  }
};

//Documents
module.exports.addDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.addDocuments.validateAsync(req.body);
    const tutorData = await Model.User.findOne({
      _id: req.user._id,
      isDeleted: false
    });

    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    let documents = req.body.documents;
    let create = [];
    for (let i = 0; i < documents.length; i++) {
      req.body = documents[i];
      req.body.tutorId = req.user._id;
      if (req.body._id) {
        let updatedDoc = await Model.RequiredDocuments.findOneAndUpdate({
          _id: ObjectId(req.body._id),
          tutorId: req.user._id
        },{
          $set: req.body
        },{
          new: true
        });
        create.push(updatedDoc);
      } else {
        let result = await Model.RequiredDocuments.create(req.body);
        create.push(result);

        let profile;
        if (req.body.documentType == constants.DOCUMENT_TYPE.ACHIEVEMENTS) {
          profile = constants.PROFILE_STATUS.ACHIEVEMENT;
        }

        if (req.body.documentType == constants.DOCUMENT_TYPE.CERTIFICATES) {
          profile = constants.PROFILE_STATUS.CERTIFICATES;
        }

        if (req.body.documentType == constants.DOCUMENT_TYPE.VERIFICATION_DOCS) {
          profile = constants.PROFILE_STATUS.DOCUMENT;
        }

        await Model.User.findOneAndUpdate({
          _id: req.user._id,
          isDeleted: false
        }, {
          $set: {
            profileCompletedAt: profile
          }
        }, {
          new: true
        });
      }
    }

    return res.success(
      constants.MESSAGES[lang].DOCUMENT_CREATED_SUCCESSFULLY, create
    );

  } catch (error) {
    next(error);
  }
};
module.exports.getDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let qry = {};
    if (req.query.documentType) {
      qry.documentType = Number(req.query.documentType);
    }

    let pipeline = [{
        $match: {
          tutorId: req.user._id,
          isDeleted: false
        }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [document] = await Model.RequiredDocuments.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      document: document.data,
      totalDocuments: document.total
    });
  } catch (error) {
    next(error);
  }
};
module.exports.updateDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateDocuments.validateAsync(req.body);
    const documentData = await Model.RequiredDocuments.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!documentData) {
      throw new Error(constants.MESSAGES[lang].DOCUMENT_NOT_FOUND);
    }
    const doc = await Model.RequiredDocuments.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    },{
      $set: req.body
    },{
      new: true
    });
    return res.success(constants.MESSAGES[lang].DOCUMENT_UPDATED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const documentData = await Model.RequiredDocuments.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!documentData) {
      throw new Error(constants.MESSAGES[lang].DOCUMENT_NOT_FOUND);
    }
    const doc = await Model.RequiredDocuments.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    },{
      isDeleted: true
    },{
      new: true
    });

    return res.success(constants.MESSAGES[lang].DOCUMENT_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

//Dashboard
const revenueGraph = async (req) => {
  const date2 = moment(new Date());
  const StartofWeek = new Date(date2.startOf("week"));
  const EndofWeek = new Date(date2.endOf("week"));
  const date3 = moment(new Date());
  const startOFMonth = new Date(date3.startOf("month"));
  const endOFMonth = new Date(date3.endOf("month"));
  const date4 = moment(new Date());
  const startOFYear = new Date(date4.startOf("years"));
  const endOFYear = new Date(date4.endOf("years"));
  let earning;
  let qry = {};

  if (req.query.type === "daily") {
    var D1 = 0,
      D2 = 0,
      D3 = 0,
      D4 = 0,
      D5 = 0,
      D6 = 0,
      D7 = 0;
    earning = await Model.User.aggregate([{
        $match: {
          _id: req.user._id,
          isDeleted: false
        }
      },{
        $match: {
          createdAt: {
            $gte: StartofWeek,
            $lte: EndofWeek
          }
        }
      },{
        $match: qry
      }
    ]);
    earning.map((val) => {
      let day = moment(val.createdAt).format("dd");
      // eslint-disable-next-line default-case
      switch (day) {
        case "Mo":
          D1 = D1 + val.totalEarn;
          break;
        case "Tu":
          D2 = D2 + val.totalEarn;
          break;
        case "We":
          D3 = D3 + val.totalEarn;
          break;
        case "Th":
          D4 = D4 + val.totalEarn;
          break;
        case "Fr":
          D5 = D5 + val.totalEarn;
          break;
        case "Sa":
          D6 = D6 + val.totalEarn;
          break;
        case "Su":
          D7 = D7 + val.totalEarn;
          break;
      }
    });
    var Brr = [D1, D2, D3, D4, D5, D6, D7];
    let dayArr = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY"
    ];
    let a = [];
    Brr.forEach((e, index) => {
      a.push({
        name: dayArr[index],
        value: e
      });
    });
    Brr = a;
  } else if (req.query.type === "weekly") {
    let W1 = 0,
      W2 = 0,
      W3 = 0,
      W4 = 0,
      W5 = 0;
    earning = await Model.User.aggregate([{
        $match: {
          _id: req.user._id,
          isDeleted: false
        }
      },{
        $match: {
          createdAt: {
            $gte: startOFMonth,
            $lte: endOFMonth
          }
        }
      },{
        $match: qry
      }
    ]);
    earning.map((val) => {
      let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
      // eslint-disable-next-line default-case
      switch (week) {
        case 1:
          W1 = W1 + val.totalEarn;
          break;
        case 2:
          W2 = W2 + val.totalEarn;
          break;
        case 3:
          W3 = W3 + val.totalEarn;
          break;
        case 4:
          W4 = W4 + val.totalEarn;
          break;
        case 5:
          W5 = W5 + val.totalEarn;
          break;
      }
    });
    Brr = [W1, W2, W3, W4, W5];
    let weekArr = ["WEEK 1", "WEEK 2", "WEEK 3", "WEEK 4", "WEEK 5"];
    let a = [];
    Brr.forEach((e, index) => {
      a.push({
        name: weekArr[index],
        value: e
      });
    });
    Brr = a;
  } else if (req.query.type === "monthly") {
    let M1 = 0,
      M2 = 0,
      M3 = 0,
      M4 = 0,
      M5 = 0,
      M6 = 0,
      M7 = 0,
      M8 = 0,
      M9 = 0,
      M10 = 0,
      M11 = 0,
      M12 = 0;

    earning = await Model.User.aggregate([{
        $match: {
          _id: req.user._id,
          isDeleted: false
        }
      },{
        $match: {
          createdAt: {
            $gte: startOFYear,
            $lte: endOFYear
          }
        }
      }
    ]);

    earning.map((val) => {
      let month = Math.ceil(Number(moment(val.createdAt).format("M")));

      // eslint-disable-next-line default-case
      switch (month) {
        case 1:
          M1 = M1 + val.totalEarn;
          break;
        case 2:
          M2 = M2 + val.totalEarn;
          break;
        case 3:
          M3 = M3 + val.totalEarn;
          break;
        case 4:
          M4 = M4 + val.totalEarn;
          break;
        case 5:
          M5 = M5 + val.totalEarn;
          break;
        case 6:
          M6 = M6 + val.totalEarn;
          break;
        case 7:
          M7 = M7 + val.totalEarn;
          break;
        case 8:
          M8 = M8 + val.totalEarn;
          break;
        case 9:
          M9 = M9 + val.totalEarn;
          break;
        case 10:
          M10 = M10 + val.totalEarn;
          break;
        case 11:
          M11 = M11 + val.totalEarn;
          break;
        case 12:
          M12 = M12 + val.totalEarn;
          break;
      }
    });
    Brr = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12];
    let mnthArr = [
      "JAN",
      "FEB",
      "MAR",
      "APRIL",
      "MAY",
      "JUNE",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC"
    ];
    let a = [];
    Brr.forEach((e, index) => {
      a.push({
        name: mnthArr[index],
        value: e
      });
    });
    Brr = a;
  } else if (req.query.type === "yearly") {
    earning = await Model.User.aggregate([{
        $match: {
          _id: req.user._id,
          isDeleted: false
        }
      },{
        $addFields: {
          year: {
            $year: "$createdAt"
          }
        }
      },{
        $group: {
          _id: "$year",
          total: {
            $sum: "$totalEarn"
          }
        }
      }
    ]);
    let map = [];
    earning.map(row => {
      map.push({
        name: row._id,
        value: row.total
      });
    });
    Brr = map;
  }
  return Brr;
};

module.exports.dashboard = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    const userId = req.user._id;

    const tutor = await Model.User.findById(userId);
    const totalEarnings = tutor.totalEarn;
    const followers = tutor?.followers || 0;
    let withdrawAmount = tutor.withdrawAmount;
    let balance = tutor.balance;
    let avgRating = tutor.avgRating;
    let oneOnOneEarn =  tutor.oneOnOneEarn;
    let classEarn = tutor.classEarn;
    let giftsEarn = tutor. giftsEarn;

    const giftData = await Model.Content.aggregate([
      {
        $match: {
          userId,
          isDeleted: false,
          status: true
        }
      },
      {
        $group: {
          _id: null,
          totalGiftCount: { $sum: "$giftCount" }
        }
      }
    ]);
    const totalGifts = giftData[0]?.totalGiftCount || 0;

    const totalBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL
    });

    const upcomingBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL,
      bookingStatus: {
        $in: [
          constants.BOOKING_STATUS.PENDING,
          constants.BOOKING_STATUS.ACCEPTED
        ]
      }
    });

    const completedBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL,
      bookingStatus: constants.BOOKING_STATUS.COMPLETED
    });

    const cancelledBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL,
      bookingStatus: constants.BOOKING_STATUS.CANCELLED
    });

     const onlineBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL,
      classModeOnline: true
    });

    const offlineBooking = await Model.Booking.countDocuments({
      tutorId: userId,
      type: constants.BOOK_TYPE.NORMAL,
      classModeOnline: false
    });

    const onlineClass = await Model.Classes.countDocuments({
      tutorId: userId,
      classMode: constants.CLASS_MODE.ONLINE,
      isDeleted: false
    });

    const offlineClass = await Model.Classes.countDocuments({
      tutorId: userId,
      classMode: constants.CLASS_MODE.OFFLINE,
      isDeleted: false
    });

    const hybridClass = await Model.Classes.countDocuments({
      tutorId: userId,
      classMode: constants.CLASS_MODE.HYBRID,
      isDeleted: false
    });

    let pipeline = [{
        $match: {
          tutorId: userId
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
        }
      },{
        $unwind: {
          path: "$parents",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "bookingdetails",
          localField: "_id",
          foreignField: "bookingId",
          as: "bookingdetails"
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          "parents.name": 1,
          "parents.image": 1,
          "bookingdetails._id": 1,
          "bookingdetails.date": 1,
          "bookingdetails.startTime": 1,
          "bookingdetails.endTime": 1,
          "subjects.name": 1,
          totalPrice: 1,
          bookingStatus: 1,
          bookType: 1,
          classPrice: 1,
          grandTotal: 1,
          promocodeId: 1,
          createdAt: 1,
          revenuesGraph: 1
        }
      }
    ];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [booking] = await Model.Booking.aggregate(pipeline);

    let pendingPayout = await Model.TutorWithdraw.findOne({
      tutorId: userId,
      withdrawStatus: constants.WITHDRAW_STATUS.PENDING,
      isDeleted: false
    }).select("withdraw");

    let lastWithdrawl = await Model.TutorWithdraw.findOne({
      tutorId: userId,
      withdrawStatus: constants.WITHDRAW_STATUS.ACCEPTED,
      isDeleted: false
    }).select("withdraw updatedAt");

    let result = await Model.Content.aggregate([
      {
        $match: {
          userId,
          isDeleted: false
        }
      },{
        $group: {
          _id: null,
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likeCount" },
          totalShares: { $sum: "$shareCount" },
          totalSaves: { $sum: "$saveCount" }
        }
      }
    ]);

    let contentStats = result.length
      ? result[0]
      : {
          totalViews: 0,
          totalLikes: 0,
          totalShares: 0,
          totalSaves: 0
        };

    let reviewCount = await Model.Rating.countDocuments({
      tutorId: userId
    });

    // Rating breakdown
    const ratingBreakdownRaw = await Model.Rating.aggregate([
      {
        $match: {
          tutorId: userId
        }
      },{
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      }
    ]);

    let breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingBreakdownRaw.forEach(r => {
      breakdown[r._id] = r.count;
    });

    const ratingPercentages = {};
    Object.keys(breakdown).forEach(star => {
      ratingPercentages[star] =
        reviewCount > 0
          ? Math.round((breakdown[star] / reviewCount) * 100)
          : 0;
    });
    let revenuesGraph = await revenueGraph(req);
    return res.success(constants.MESSAGES[lang].Data_FETCHED, {
      totalEarnings,
      totalBooking,
      booking,
      withdrawAmount,
      balance,
      totalGifts,
      followers,
      pendingPayout,
      lastWithdrawl,
      upcomingBooking,
      completedBooking,
      cancelledBooking,
      onlineClass,
      offlineClass,
      hybridClass,
      contentStats,
      avgRating,
      reviewCount,
      ratingBreakdown: breakdown,
      ratingPercentages,
      oneOnOneEarn,
      classEarn,
      giftsEarn,
      onlineBooking,
      offlineBooking,
      revenuesGraph
    });
  } catch (error) {
    next(error);
  }
};


//Withdraw
module.exports.withdraw = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.withdraw.validateAsync(req.body);
    let tutorDetails = await Model.User.findOne({
      _id: req.user._id,
      isDeleted: false
    }).select({
      name: 1,
      email: 1,
      phoneNo: 1,
      balance: 1
    });

    let withdrawStatus = await Model.TutorWithdraw.findOne({
      tutorId: req.user._id,
      isDeleted: false,
      withdrawStatus: constants.WITHDRAW_STATUS.PENDING
    });

    if (withdrawStatus) {
      throw new Error(constants.MESSAGES[lang].WITHDRAW_REQUEST_ALREADY_PENDING);
    }

    let currentBalance = tutorDetails.balance;

    if (currentBalance < req.body.withdraw) {
      throw new Error(constants.MESSAGES[lang].WITHDRAW_AMOUNT_IS_MORE);
    }

    req.body.tutorId = req.user._id;
    let withDrawDetails = await Model.TutorWithdraw.create(req.body);

    let admin = await Model.Admin.findOne({
      isDeleted: false
    });

    process.emit("sendNotification", {
      adminId: admin._id,
      receiverId: admin._id,
      values: {
        name: req.user.name,
        amount: req.body.withdraw
      },
      role: constants.ROLE.ADMIN,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.WITHDRAWL_REQUEST
    });

    process.emit("withdrawRequest", {
      adminId: admin._id,
      tutorDetails: tutorDetails,
      withDrawDetails: withDrawDetails,
      balance: currentBalance - req.body.withdraw
    });

    // Respond success
    return res.success(
      constants.MESSAGES[lang].WITHDRAW_DETAIL_CREATED_SUCCESSFULLY,
      withDrawDetails
    );
  } catch (error) {
    next(error);
  }
};

//Booking
module.exports.getBooking = async (req, res, next) => {
  try {
    let id = req.params.id;
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let qry = {};

    if (id == null) {
      if (req.query.bookingType == constants.BOOKING_TYPE.UPCOMING) {
        qry.bookingStatus = {
          $in: [constants.BOOKING_STATUS.PENDING, constants.BOOKING_STATUS.ACCEPTED]
        };
      } else if (req.query.bookingType == constants.BOOKING_TYPE.PAST) {
        qry.bookingStatus = {
          $in: [
            constants.BOOKING_STATUS.COMPLETED,
            constants.BOOKING_STATUS.REJECTED,
            constants.BOOKING_STATUS.CANCELLED
          ]
        };
      } else if (req.query.bookingType == constants.BOOKING_TYPE.ONGOING) {
        qry.bookingStatus = {
          $in: [constants.BOOKING_STATUS.ONGOING]
        };
      }
      if (req.query.bookingStatus == constants.BOOKING_STATUS.ACCEPTED) {
        qry.bookingStatus = {
          $in: [constants.BOOKING_STATUS.ACCEPTED, constants.BOOKING_STATUS.ONGOING]
        };
      }

      let pipeline = [{
          $match: {
            tutorId: req.user._id,
            bookType: constants.BOOK_TYPE.NORMAL 
          }
        },{
          $lookup: {
            from: "users",
            localField: "parentId",
            foreignField: "_id",
            as: "parents"
          }
        },{
          $unwind: {
            path: "$parents",
            preserveNullAndEmptyArrays: true
          }
        },{
          $lookup: {
            from: "bookingdetails",
            localField: "_id",
            foreignField: "bookingId",
            as: "bookingdetails"
          }
        },{
          $lookup: {
            from: "parentaddresses",
            localField: "parentAddressId",
            foreignField: "_id",
            as: "address"
          }
        },{
          $unwind: {
            path: "$address",
            preserveNullAndEmptyArrays: true
          }
        },{
          $lookup: {
            from: "subjects",
            localField: "subjectId",
            foreignField: "_id",
            as: "subjects"
          }
        },{
          $match: qry
        },{
          $sort: {
            createdAt: -1
          }
        },{
          $project: {
            "parents._id": 1,
            "parents.name": 1,
            "parents.image": 1,
            "teachingdetails.price": 1,
            "bookingdetails._id": 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails.bookingStatus": 1,
            "bookingdetails.pairingType": 1,
            classId: 1,
            subjects: 1,
            bookingStatus: 1,
            address: 1,
            createdAt: 1,
            grandTotal: 1,
            invoiceNo: 1,
            pairingType: 1,
            dyteMeeting: 1,
            additionalInfo: 1,
            cancelReason: 1,
            cancelledAt: 1,
            learnToday: 1,
            classModeOnline: 1,
            tutorMoney: 1,
            serviceType: 1,
            serviceCharges: 1,
            totalTransportationFees: 1
          }
        }];

      pipeline = await common.pagination(pipeline, skip, limit);
      let [booking] = await Model.Booking.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        booking: booking.data,
        totalBooking: booking.total
      });

    } else {
      let pipeline = [{
          $match: {
            _id: ObjectId(id),
            tutorId: req.user._id
          }
        },{
          $lookup: {
            from: "users",
            localField: "parentId",
            foreignField: "_id",
            as: "parents"
          }
        },{
          $unwind: {
            path: "$parents",
            preserveNullAndEmptyArrays: true
          }
        },{
          $lookup: {
            from: "bookingdetails",
            localField: "_id",
            foreignField: "bookingId",
            as: "bookingdetails"
          }
        },{
          $lookup: {
            from: "parentaddresses",
            localField: "parentAddressId",
            foreignField: "_id",
            as: "address"
          }
        },{
          $unwind: {
            path: "$address",
            preserveNullAndEmptyArrays: true
          }
        },{
          $lookup: {
            from: "subjects",
            localField: "subjectId",
            foreignField: "_id",
            as: "subjects"
          }
        },{
          $lookup: {
            from: "contentmaterials",
            localField: "_id",
            foreignField: "bookingId",
            as: "contentMaterial"
          }
        },{
          $match: qry
        },{
          $project: {
            bookingNumber: 1,
            address: 1,
            "parents.name": 1,
            "parents._id": 1,
            "tutors.address": 1,
            "tutors.latitude": 1,
            "tutors.longitude": 1,
            "parents.image": 1,
            "bookingdetails._id": 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails.bookingStatus": 1,
            "bookingdetails.pairingType": 1,
            "bookingdetails.distance": 1,
            "bookingdetails.callJoinedByTutor": 1,
            "bookingdetails.callJoinedByParent": 1,
            subjects: 1,
            classId: 1,
            additionalInfo: 1,
            totalNoOfHours: 1,
            totalPrice: 1,
            totalDistance: 1,
            bookingStatus: 1,
            contentMaterial: 1,
            createdAt: 1,
            grandTotal: 1,
            invoiceNo: 1,
            dyteMeeting: 1,
            pairingType: 1,
            cancelReason: 1,
            cancelledAt: 1,
            refundStatus: 1,
            refundRejectReason: 1,
            refundDate: 1,
            learnToday: 1,
            classModeOnline: 1,
            tutorMoney: 1,
            serviceFees: 1,
            totalTransportationFees: 1,
            serviceType: 1,
            serviceCharges: 1
          }
        }];

      let [booking] = await Model.Booking.aggregate(pipeline);
      let connectionId = "";
      if (booking) {
        connectionId = await common.findUniqueConnectId(
          booking.parents._id.toString(),
          req.user._id.toString()
        );
      }
      booking.connectionId = connectionId.toString();
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.updateBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateBooking.validateAsync(req.body);
    let booking = await Model.Booking.findById(req.params.id);
    if (!booking) {
      throw new Error(constants.MESSAGES[lang].BOOKING_NOT_FOUND);
    }
    if (booking.bookingStatus == constants.BOOKING_STATUS.CANCELLED) {
      throw new Error(constants.MESSAGES[lang].BOOKING_CANCELLED);
    }

    let findDetails = await Model.BookingDetails.find({
      bookingId: ObjectId(req.params.id),
      pairingType: constants.PAIRING_TYPE.END
    });

    if (findDetails && req.body.bookingStatus == constants.BOOKING_STATUS.CANCELLED) {
      // partial
      let refundFindDetails = await Model.BookingDetails.find({
        bookingId: ObjectId(req.params.id),
        pairingType: constants.PAIRING_TYPE.PENDING
      });
      let refundAmt = refundFindDetails.reduce((total, detail) => total + detail.price, 0);
      req.body.refundAmount = refundAmt;
      req.body.refundType = constants.REFUND_TYPE.PARTIAL_CLASS_REFUND_AMOUNT;
    } else {
      req.body.refundAmount = booking.grandTotal;
      req.body.refundType = constants.REFUND_TYPE.TUTOR;
    }
    req.body.refundRequest = true;
    req.body.cancelledAt = new Date();

    const doc = await Model.Booking.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id
    }, {
      $set: req.body
    }, {
      new: true
    });

    if (req.body.bookingStatus) {
      await Model.BookingDetails.updateMany({
        bookingId: doc._id,
        bookingStatus: constants.BOOKING_STATUS.PENDING
      }, {
        $set: {
          bookingStatus: doc.bookingStatus
        },
        new: true
      });
    }

    process.emit("sendNotification", {
      parentId: doc.parentId,
      receiverId: doc.parentId,
      values: doc,
      role: constants.ROLE.PARENT,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.BOOKING_REJECTED
    });

    return res.success(
      constants.MESSAGES[lang].BOOKING_UPDATED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};
module.exports. pairingOtp = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.pairingOtp.validateAsync(req.body);
    let booking = await Model.Booking.findById(req.body.bookingId);
    let bookingDetail = await Model.BookingDetails.findById(req.body.bookingDetailId);
    if (!bookingDetail) {
      throw new Error(constants.MESSAGES[lang].BOOKING_NOT_FOUND);
    }
    if (bookingDetail.bookingStatus == constants.BOOKING_STATUS.CANCELLED) {
      throw new Error(constants.MESSAGES[lang].BOOKING_CANCELLED);
    }
    let otp = functions.generateNumber(4);
    let pairingType;

      if (req.body.pairingType === constants.PAIRING_TYPE.START) {
        // Create Dyte meeting before saving the class

        let dyteMeeting = null;
    try {
      const dyteResponse = await axios.post('https://api.realtime.cloudflare.com/v2/meetings', {
        title: req.body.topic || 'TutorHail Class',
        preferred_region: 'ap-south-1',
        record_on_start: false
      }, {
        headers: {
          'Authorization': 'Basic MTVhMzAyZTgtYTEzMy00NDk1LTlkOWYtZThjODRlYzAwNTUwOjVmNDJmZTY1ZTI1NDA0NDg0MGQ2',
          'Content-Type': 'application/json'
        }
      });

      if (dyteResponse.data && dyteResponse.data.success) {
        dyteMeeting = dyteResponse.data;

        // Add Dyte meeting information to the class data
        req.body.dyteMeeting = {
          meetingId: dyteMeeting.data.id,
          title: dyteMeeting.data.title,
          preferred_region: dyteMeeting.data.preferred_region,
          record_on_start: dyteMeeting.data.record_on_start,
          live_stream_on_start: dyteMeeting.data.live_stream_on_start,
          persist_chat: dyteMeeting.data.persist_chat,
          summarize_on_end: dyteMeeting.data.summarize_on_end,
          is_large: dyteMeeting.data.is_large,
          status: dyteMeeting.data.status,
          created_at: dyteMeeting.data.created_at,
          updated_at: dyteMeeting.data.updated_at
        };
      }
    } catch (dyteError) {
      console.error('Dyte API error:', dyteError.message);
      // Continue with class creation even if Dyte fails
    }


        pairingType = constants.PAIRING_TYPE.START;
        await Model.Booking.findOneAndUpdate({
          _id: ObjectId(req.body.bookingId)
        }, {
          $set: {
            dyteMeeting: req.body.dyteMeeting,
            bookingStatus: constants.BOOKING_STATUS.ACCEPTED,
            acceptedAt: new Date()
          }
        }, {
          new: true
        });

        await Model.BookingDetails.updateMany({
          bookingId: ObjectId(req.body.bookingId)
        }, {
          $set: {
            bookingStatus: constants.BOOKING_STATUS.ACCEPTED,
            dyteMeeting: req.body.dyteMeeting
          }
        }, {
          new: true
        });
        process.emit("sendNotification", {
          parentId: booking.parentId,
          receiverId: booking.parentId,
          bookingId: booking._id,
          values: booking,
          role: constants.ROLE.PARENT,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.BOOKING_ACCEPTED
        });
      } else if (req.body.pairingType === constants.PAIRING_TYPE.END) {
        pairingType = constants.PAIRING_TYPE.END;
      } else {
        throw new Error(constants.MESSAGES[lang].PAIRING_TYPE_REQUIRED);
      }
      req.body.tutorId = req.user._id;
      let pairing = await Model.Otp.create({
        bookingId: req.body.bookingId,
        bookingDetailId: req.body.bookingDetailId,
        tutorId: req.body.tutorId,
        otp: otp,
        pairingType: pairingType
      });

      if (pairing) {
        process.emit("sendNotification", {
          parentId: booking.parentId,
          receiverId: booking.parentId,
          values: pairing,
          role: constants.ROLE.PARENT,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.PAIRING_OTP_START
        });
      }
      return res.success(constants.MESSAGES[lang].BOOKED_LESSON_ACCEPTED, pairing);
  } catch (error) {
    next(error);
  }
};
module.exports.verifyPairingOtp = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.verifyPairingOtp.validateAsync(req.body);
    let complete;
    let booking = await Model.Booking.findOne({
      _id: ObjectId(req.body.bookingId)
    });

    let detail = await Model.BookingDetails.findOne({
      _id: ObjectId(req.body.bookingDetailId)
    });

    let pairing, status;
      let verifyOtp = await Model.Otp.findOne({
        bookingId: ObjectId(req.body.bookingId),
        bookingDetailId: ObjectId(req.body.bookingDetailId),
        tutorId: req.user._id,
        otp: req.body.otp
      }).lean();

      if (!verifyOtp) {
        throw new Error(constants.MESSAGES[lang].INVALID_OTP);
      }
      if (req.body.pairingType === constants.PAIRING_TYPE.START) {
        pairing = await Model.BookingDetails.findOneAndUpdate({
          _id: ObjectId(req.body.bookingDetailId)
        }, {
          $set: {
            classStart: new Date(),
            bookingStatus: constants.BOOKING_STATUS.ONGOING,
            pairingType: constants.PAIRING_TYPE.START
          }
        },{
          new: true
        });

        await Model.Booking.findOneAndUpdate({
          _id: ObjectId(req.body.bookingId)
        }, {
          $set: {
            bookingStatus: constants.BOOKING_STATUS.ONGOING
          }
        }, {
          new: true
        });

        if (pairing) {
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            values: pairing,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.PAIRING
          });
          process.emit("sendNotification", {
            tutorId: booking.tutorId,
            receiverId: booking.tutorId,
            values: pairing,
            role: constants.ROLE.TUTOR,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.PAIRING
          });
        }

        let otp = functions.generateNumber(4);
        let endOtp = await Model.Otp.create({
          bookingId: ObjectId(req.body.bookingId),
          bookingDetailId: ObjectId(req.body.bookingDetailId),
          tutorId: detail.tutorId,
          otp: otp,
          pairingType: constants.PAIRING_TYPE.END
        });
        await Model.Otp.deleteOne({
          _id: verifyOtp._id
        });

        if (endOtp) {
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            values: endOtp,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.PAIRING_OTP_END
          });
        }
      } else if (req.body.pairingType === constants.PAIRING_TYPE.END) {
        status = await Model.BookingDetails.findOneAndUpdate({
          _id: ObjectId(req.body.bookingDetailId)
        },{
          $set: {
            classEnd: new Date(),
            bookingStatus: constants.BOOKING_STATUS.COMPLETED,
            pairingType: constants.PAIRING_TYPE.END
          }
        }, {
          new: true
        });
         await Model.User.findByIdAndUpdate(
            req.user._id,
            { $inc: {
              oneOnOneEarn: status.price + status.transportationFees,
              totalEarn: status.price + status.transportationFees,
              balance: status.price + status.transportationFees
             }}
          );

        let remainingBookings = await Model.BookingDetails.findOne({
          bookingId: ObjectId(req.body.bookingId),
          date: {
            $gt: new Date()
          }
        });

        let otp = functions.generateNumber(4);
        let nextBookingId = await Model.BookingDetails.findOne({
          bookingId: ObjectId(req.body.bookingId)
        }).sort({
          date: 1
        });

        let startOtp;
        if (remainingBookings) {
          startOtp = await Model.Otp.create({
            bookingId: ObjectId(req.body.bookingId),
            bookingDetailId: nextBookingId._id,
            tutorId: detail.tutorId,
            otp: otp,
            pairingType: constants.PAIRING_TYPE.START
          });
        }
        await Model.Otp.deleteOne({
          _id: verifyOtp._id
        });

        if (startOtp) {
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            values: startOtp,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.PAIRING_OTP_START
          });
        }

        if (!remainingBookings) {
          complete = await Model.Booking.findByIdAndUpdate(ObjectId(req.body.bookingId), {
            $set: {
              bookingStatus: constants.BOOKING_STATUS.COMPLETED,
              completedAt: new Date()
            }
          });
          process.emit("rating", {
            parentId: complete.parentId,
            bookingDetails: complete
          });
        }
        if (complete) {
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            values: complete,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.BOOKING_COMPLETED_PARENT
          });

          process.emit("sendNotification", {
            tutorId: booking.tutorId,
            receiverId: booking.tutorId,
            values: complete,
            role: constants.ROLE.TUTOR,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.BOOKING_COMPLETED
          });
        }

        let admin = await Model.Admin.findOne({
          isDeleted: false
        });

        if (complete) {
          process.emit("sendNotification", {
            adminId: admin._id,
            receiverId: admin._id,
            values: status,
            role: constants.ROLE.ADMIN,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.BOOKING_COMPLETED
          });
        }
      }
      if (req.body.pairingType == constants.PAIRING_TYPE.START) {
        return res.success(constants.MESSAGES[lang].JOB_STARTED_SUCCESSFULLY, verifyOtp);
      }

      if (req.body.pairingType == constants.PAIRING_TYPE.END) {
        return res.success(constants.MESSAGES[lang].JOB_ENDED_SUCCESSFULLY, verifyOtp);
      }
  } catch (error) {
    next(error);
  }
};

//Study Material
module.exports.contentMaterial = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.contentMaterial.validateAsync(req.body);

    req.body.tutorId = req.user._id;
    let contentMaterial = await Model.ContentMaterial.create(req.body);
    return res.success(
      constants.MESSAGES[lang].CONTENT_MATERIAL_UPLOADED,
      contentMaterial
    );
  } catch (error) {
    next(error);
  }
};
module.exports.getContentMaterial = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

      let pipeline = [{
          $match: {
            tutorId: req.user._id,
            isDeleted: false
          }
        },{
          $sort: {
            createdAt: -1
          }
        },{
        $project: {
          title: 1,
          description: 1,
          content: 1
        }
      }];
      pipeline = await common.pagination(pipeline, skip, limit);
      let [content] = await Model.ContentMaterial.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        material: content.data,
        totalContent: content.total
      });
  } catch (error) {
    next(error);
  }
};
module.exports.getContentMaterialById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
        $project: {
          title: 1,
          description: 1,
          content: 1
        }
      });
    let [content] = await Model.ContentMaterial.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.updateContentMaterial = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.contentMaterial.validateAsync(req.body);
    const studyId = ObjectId(req.params.id);
    const content = await Model.ContentMaterial.findOne({
      _id: studyId,
      tutorId: req.user._id,
      isDeleted: false
    });

    if (!content) {
      throw new Error(constants.MESSAGES[lang].STUDY_MATERIAL_NOT_FOUND);
    }
    const studyMaterial = await Model.ContentMaterial.findOneAndUpdate(
      { _id: studyId },
      { $set: req.body },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].STUDY_MATERIAL_UPDATED_SUCCESSFULLY,
      studyMaterial
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deleteContentMaterial = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Model.ContentMaterial.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    },{
      $set: {
        isDeleted: true
      }
    },{
      new: true
    });
    return res.success(constants.MESSAGES[lang].SUCCESS, {});
  } catch (error) {
    next(error);
  }
};

//Notification
module.exports.getNotification = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    const coTutorLookup = [
      {
        $lookup: {
          from: "classcotutors",
          let: { classId: "$classId", tutorId: "$tutorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$classId", "$$classId"] },
                    { $eq: ["$tutorId", "$$tutorId"] }
                  ]
                }
              }
            },
            { $project: { status: 1, _id: 0 } }
          ],
          as: "coTutorStatus"
        }
      },
      {
        $addFields: {
          coTutorStatus: { $arrayElemAt: ["$coTutorStatus.status", 0] }
        }
      }
    ];

    const unreadCount = await Model.Notification.countDocuments({
      tutorId: req.user._id,
      isDeleted: false,
      isRead: false
    });

    let pipeline1 = [
      {
        $match: {
          tutorId: req.user._id,
          isDeleted: false,
          isRead: false,
          role: constants.ROLE.TUTOR,
          pushType: { $ne: constants.PUSH_TYPE_KEYS.DEFAULT }
        }
      },
      { $sort: { createdAt: -1 } },
      ...coTutorLookup
    ];

    pipeline1 = await common.pagination(pipeline1, skip, limit);
    let newNotification = await Model.Notification.aggregate(pipeline1);

    let pipeline2 = [
      {
        $match: {
          tutorId: req.user._id,
          isDeleted: false,
          isRead: true,
          role: constants.ROLE.TUTOR,
          pushType: { $ne: constants.PUSH_TYPE_KEYS.DEFAULT }
        }
      },
      { $sort: { createdAt: -1 } },
      ...coTutorLookup
    ];

    pipeline2 = await common.pagination(pipeline2, skip, limit);
    let oldNotification = await Model.Notification.aggregate(pipeline2);

    await Model.Notification.updateMany(
      { tutorId: req.user._id, isDeleted: false },
      { isRead: true }
    );

    process.emit("readNotificationCount", {
      userId: String(req.user._id),
      justReadCount: unreadCount
    });

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      newNotification: newNotification.length ? newNotification[0].data : [],
      totalNewNotification: newNotification.length ? newNotification[0].total : 0,
      oldNotification: oldNotification.length ? oldNotification[0].data : [],
      totalOldNotification: oldNotification.length ? oldNotification[0].total : 0
    });
  } catch (error) {
    next(error);
  }
};

//Chat
module.exports.chatList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    const matchRole = {};
    if (req.user.secondaryRole === constants.APP_ROLE.TUTOR) {
      matchRole.tutorId = req.user._id;
    } else if (req.user.secondaryRole === constants.APP_ROLE.PARENT) {
      matchRole.parentId = req.user._id;
    }

    const searchMatch = req.query.search
      ? { _search: new RegExp(req.query.search, "i") }
      : {};

    const pipeline = [
      { $match: { ...matchRole, message: { $ne: null } } },
      {
        $group: {
          _id: "$connectionId",
          message: { $last: "$message" },
          uploadType: { $last: "$uploadType" },
          uploads: { $last: "$uploads" },
          parentId: { $last: "$parentId" },
          tutorId: { $last: "$tutorId" },
          bookingId: { $last: "$bookingId" },
          sentBy: { $last: "$sentBy" },
          createdAt: { $last: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                req.user.secondaryRole === constants.APP_ROLE.TUTOR
                  ? { $and: [{ $eq: ["$isTutorRead", false] }, { $eq: ["$sentBy", constants.APP_ROLE.PARENT] }] }
                  : { $and: [{ $eq: ["$isParentRead", false] }, { $eq: ["$sentBy", constants.APP_ROLE.TUTOR] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          let: { tutorId: "$tutorId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$tutorId"] } } },
            { $project: { name: 1, image: 1, phoneNo: 1, email: 1, isActive: 1 } }
          ],
          as: "tutorId"
        }
      },
      {
        $lookup: {
          from: "users",
          let: { parentId: "$parentId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$parentId"] } } },
            { $project: { name: 1, image: 1, phoneNo: 1, email: 1, createdAt: 1 } }
          ],
          as: "parentId"
        }
      },
      { $unwind: "$parentId" },
      { $unwind: "$tutorId" },
      {
        $lookup: {
          from: "bookings",
          let: { bookingId: "$bookingId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$$bookingId", "$_id"] } } },
            { $project: { bookingStatus: 1 } }
          ],
          as: "bookings"
        }
      },
      { $unwind: { path: "$bookings", preserveNullAndEmptyArrays: true } },
      { $match: searchMatch },
      { $sort: { createdAt: -1 } }
    ];

    const paginatedPipeline = await common.pagination(pipeline, skip, limit);
    let [chats] = await Model.ChatMessage.aggregate(paginatedPipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      chat: chats.data,
      totalchat: chats.total
    });
  } catch (error) {
    next(error);
  }
};

module.exports.chating = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let qry = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");
      qry._search = regex;
    }

    let pipeline = [
      { $match: { connectionId: req.params.id } },
      {
        $lookup: {
          from: "users",
          let: { tutorId: "$tutorId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$tutorId"] } } },
            {
              $project: {
                name: 1,
                image: 1,
                phoneNo: 1,
                email: 1,
                documentVerification: 1,
                isActive: 1
              }
            }
          ],
          as: "tutorId"
        }
      },
      {
        $lookup: {
          from: "users",
          let: { parentId: "$parentId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$parentId"] } } },
            {
              $project: {
                name: 1,
                image: 1,
                phoneNo: 1,
                email: 1
              }
            }
          ],
          as: "parentId"
        }
      },
      { $unwind: "$parentId" },
      { $unwind: "$tutorId" },
      {
        $lookup: {
          from: "bookings",
          let: { bookingId: "$bookingId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$$bookingId", "$_id"] } } },
            { $project: { bookingStatus: 1 } }
          ],
          as: "bookings"
        }
      },
      { $unwind: { path: "$bookings", preserveNullAndEmptyArrays: true } },
      { $match: qry },
      { $sort: { createdAt: -1 } }
    ];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [chating] = await Model.ChatMessage.aggregate(pipeline);
    let chatAgree = await Model.ChatAgreement.findOne({
      chatId: req.params.id
    });

    if (req.user.secondaryRole == constants.APP_ROLE.TUTOR) {
      const unreadMessages = await Model.ChatMessage.find({
        connectionId: req.params.id,
        isTutorRead: false
      }).select("parentId");

      const justReadCount = unreadMessages.length;

      if (justReadCount > 0) {
        const parentId = unreadMessages[0]?.parentId;

        if (parentId) {
          process.emit("readMessage", {
            userId: String(parentId),
            isTutorRead: true
          });
        }
        await Model.ChatMessage.updateMany(
          { connectionId: req.params.id, isTutorRead: false },
          { $set: { isTutorRead: true } }
        );
        process.emit("readMessageCount", {
          userId: String(req.user._id),
          justReadCount
        });
      }
    } else if (req.user.secondaryRole == constants.APP_ROLE.PARENT) {
      const unreadMessages = await Model.ChatMessage.find({
        connectionId: req.params.id,
        isParentRead: false
      }).select("tutorId");

      const justReadCount = unreadMessages.length;

      if (justReadCount > 0) {
        const tutorId = unreadMessages[0]?.tutorId;
        if (tutorId) {
          process.emit("readMessage", {
            userId: String(tutorId),
            isParentRead: true
          });
        }
        await Model.ChatMessage.updateMany(
          { connectionId: req.params.id, isParentRead: false },
          { $set: { isParentRead: true } }
        );
        process.emit("readMessageCount", {
          userId: String(req.user._id),
          justReadCount
        });
      }
    }

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      message: chating?.data || [],
      totalmessage: chating?.total || 0,
      chatAgree: chatAgree || {}
    });
  } catch (error) {
    next(error);
  }
};

//Video Call
module.exports.joinVideoCall = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.callToken.validateAsync(req.body);

    let joinCallDetails = await Model.BookingDetails.findOneAndUpdate({
      _id: ObjectId(req.body.bookingDetailId),
      isDeleted: false
    }, {
      $set: {
        bookingStatus: constants.BOOKING_STATUS.ONGOING,
        classStart: new Date(),
        callJoinedByTutor: true
      }
    }, {
      new: true
    }).populate("bookingId", "parentId");

    await Model.Booking.findOneAndUpdate({
      _id: joinCallDetails.bookingId._id
    }, {
      bookingStatus: constants.BOOKING_STATUS.ONGOING
    }, {
      new: true
    });

    process.emit("sendNotification", {
      parentId: joinCallDetails.bookingId.parentId,
      receiverId: joinCallDetails.bookingId.parentId,
      values: joinCallDetails,
      role: constants.ROLE.PARENT,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.TUTOR_CALL_JOINED
    });
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, joinCallDetails);

  } catch (error) {
    next(error);
  }
};

//Review
module.exports.getReviews = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let qry = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i");
      qry._search = regex;
    }
    let ratingUsers = await Model.Rating.countDocuments({
      tutorId: req.user._id,
      isDeleted: false
    });

    let pipeline = [{
        $match: {
          isDeleted: false,
          tutorId: req.user._id
        }
      },{
        $lookup: {
          from: "parents",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
        }
      },{
        $unwind: {
          path: "$parents",
          preserveNullAndEmptyArrays: true
        }
      },{
        $match: qry
      },{
        $project: {
          "parents.name": 1,
          "parents.image": 1,
          rating: 1,
          review: 1,
          avgRating: 1,
          createdAt: 1
        }
      },{
        $sort: {
          createdAt: -1
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [ratingDetail] = await Model.Rating.aggregate(pipeline);

    let pipelines = [{
        $match: {
          isDeleted: false,
          tutorId: req.user._id
        }
      },{
        $group: {
          _id: null,
          ratingGrp: {
            $sum: 1
          },
          avgRating: {
            $avg: "$rating"
          }
        }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      }];

    pipelines = await common.pagination(pipelines, skip, limit);
    let [rating] = await Model.Rating.aggregate(pipelines);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      ratingUsers,
      rating: rating.data,
      ratingDetail: ratingDetail.data,
      totalRatingDetail: ratingDetail.total
    });

  } catch (error) {
    next(error);
  }
};

//customer Support
module.exports.support = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.support.validateAsync(req.body);
    const data = await Model.CustomerSupport.create({
      tutorId: req.user._id,
      customerType: constants.CUSTOMER_TYPE.TUTOR,
      title: req.body.title,
      query: req.body.query,
      supportType: req.body.supportType
    });

    let notificationType;
    if (data.supportType == constants.SUPPORT_TYPE.COMPLAINT) {
      notificationType = constants.PUSH_TYPE_KEYS.COMPLAINT;
    } else if (data.supportType == constants.SUPPORT_TYPE.QUERY) {
      notificationType = constants.PUSH_TYPE_KEYS.QUERY;
    }

    let admin = await Model.Admin.findOne({
      isDeleted: false
    });
    process.emit("sendNotification", {
      adminId: admin._id,
      receiverId: admin._id,
      values: data,
      role: constants.ROLE.ADMIN,
      isNotificationSave: true,
      pushType: notificationType
    });
    return res.success(constants.MESSAGES[lang].SUCCESS, data);
  } catch (error) {
    next(error);
  }
};

//cms
module.exports.getCms = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const cmsData = await Model.Cms.findOne({});
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, cmsData);
  } catch (error) {
    next(error);
  }
};

module.exports.refundAmountCron = async () => {
  try {
    let bookings = await Model.Booking.find({
      bookingStatus: constants.BOOKING_STATUS.ONGOING,
      isRefunded: false
    });

    if (bookings.length == 0) return;
    for (let i = 0; i < bookings.length; i++) {

      let bookingId = bookings[i]._id;
      let booking = await Model.Booking.findById(bookingId).populate("parentId", "name");
      if (!booking) return;
      if (booking.bookingStatus == constants.BOOKING_STATUS.CANCELLED) return;

      let findDetails = await Model.BookingDetails.find({
        bookingId: bookingId,
        isDeleted: false,
        startTime: {
          $lt: new Date()
        },
        pairingType: constants.PAIRING_TYPE.PENDING
      });

      if (findDetails.length > 0) {
        let bookingDetails = await Model.BookingDetails.updateMany({
          bookingId: findDetails.bookingId,
          pairingType: constants.PAIRING_TYPE.PENDING
        }, {
          $set: {
            bookingStatus: constants.BOOKING_STATUS.CANCELLED
          },
          new: true
        });
        if (!bookingDetails) return;

        let totalSum = 0;
        for (let i = 0; i < bookingDetails.length; i++) {
          totalSum += bookingDetails[i].price;
        }

        let confirmationCode = booking.confirmationCode;
        let payment = totalSum;
        let name = booking.parentId.name;

        await cart.refundPayment(confirmationCode, payment, name);

        await Model.Booking.findOneAndUpdate({
          _id: ObjectId(bookingId)
        }, {
          $set: {
            refundAmount: payment,
            isRefunded: true,
            refundDate: Date.now(),
            bookingStatus: constants.BOOKING_STATUS.CANCELLED,
            refundRequest: true
          }
        }, {
          new: true
        });
      }
    }
  } catch (error) {
    console.log('error: ', error);
  }
};

//Listing
module.exports.subClassList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          tutorId: req.user._id
        }
      },{
        $project: {
          classes: 1
        }
      }];
    let subject = await Model.TeachingDetails.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, subject);
  } catch (error) {
    next(error);
  }
};
module.exports.tutorList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let currentUserId = req.user._id;
    let search = req.query.search ? new RegExp(req.query.search, "i") : null;

    let pipeline = [
      {
        $match: {
          _id: { $ne: currentUserId },
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search } },
            { userName: { $regex: search } }
          ]
        }
      });
    }

    pipeline.push({
      $project: {
        name: 1,
        userName: 1
      }
    });

    let tutor = await Model.User.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);
  } catch (error) {
    next(error);
  }
};
module.exports.promocodeList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];
    let qry = {};

    if (req.query.type) {
      qry.type = Number(req.query.type);
    }
    const now = new Date();
    pipeline.push({
      $match: {
        tutorId: req.user._id,
        isDeleted: false,
        expiryDate: { $gte: now },
        $or: [
          { startDate: { $exists: false } },
          { startDate: null },
          { startDate: { $lte: now } }
        ],
        ...qry
      }
    });

    pipeline.push({
      $sort: { createdAt: -1 }
    });

    pipeline.push({
      $project: {
        name: 1,
        codeName: 1,
        maxUser: 1,
        usedCount: 1
      }
    });
    let promoCode = await Model.PromoCode.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promoCode);
  } catch (error) {
    next(error);
  }
};

//Class
module.exports.createClass = async (req, res, next) => {
  try {
    const lang = req.headers.lang || 'en';
    await Validation.Tutor.addClass.validateAsync(req.body);
    const { promoCodeId, classSlots, payment } = req.body;
    // Handle start & end date
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      const slotDates = classSlots.map(slot => new Date(slot.date));
      const minDate = new Date(Math.min(...slotDates));
      const maxDate = new Date(Math.max(...slotDates));
      req.body.startDate = minDate;
      req.body.lastDate = maxDate;
    }

    // Calculate total fees
    if (payment == constants.CLASS_PAYMENT.PER_HOUR) {
      let hour = req.body.duration / 60;
      req.body.totalFees = req.body.fees * hour;
    } else if (payment == constants.CLASS_PAYMENT.SESSION) {
      req.body.totalFees = req.body.fees;
    }

    // Create Dyte meeting before saving the class
    let dyteMeeting = null;
    try {
      const dyteResponse = await axios.post('https://api.realtime.cloudflare.com/v2/meetings', {
        title: req.body.topic || 'TutorHail Class',
        preferred_region: 'ap-south-1',
        record_on_start: false
      }, {
        headers: {
          'Authorization': 'Basic MTVhMzAyZTgtYTEzMy00NDk1LTlkOWYtZThjODRlYzAwNTUwOjVmNDJmZTY1ZTI1NDA0NDg0MGQ2',
          'Content-Type': 'application/json'
        }
      });

      if (dyteResponse.data && dyteResponse.data.success) {
        dyteMeeting = dyteResponse.data;
        req.body.dyteMeeting = {
          meetingId: dyteMeeting.data.id,
          title: dyteMeeting.data.title,
          preferred_region: dyteMeeting.data.preferred_region,
          record_on_start: dyteMeeting.data.record_on_start,
          live_stream_on_start: dyteMeeting.data.live_stream_on_start,
          persist_chat: dyteMeeting.data.persist_chat,
          summarize_on_end: dyteMeeting.data.summarize_on_end,
          is_large: dyteMeeting.data.is_large,
          status: dyteMeeting.data.status,
          created_at: dyteMeeting.data.created_at,
          updated_at: dyteMeeting.data.updated_at
        };
      }
    } catch (dyteError) {
      console.error('Dyte API error:', dyteError.message);
      // Continue with class creation even if Dyte fails
    }

    req.body.tutorId = req.user._id;

    // Create class
    const newClass = await Model.Classes.create(req.body);

    // Attach promo codes
    if (Array.isArray(promoCodeId) && promoCodeId.length > 0) {
      for (let promoId of promoCodeId) {
        await Model.PromoCode.updateOne(
          { _id: promoId, tutorId: req.user._id, isDeleted: false },
          { $addToSet: { classIds: newClass._id } }
        );
      }
    }

    // Insert class slots
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      const slotsToInsert = classSlots.map(slot => ({
        tutorId: newClass.tutorId,
        classId: newClass._id,
        timezone: req.body.timezone || '',
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        seats: slot.seats || newClass.seats,
        remainingSeats: slot.remainingSeats || slot.seats || newClass.seats
      }));
      await Model.ClassSlots.insertMany(slotsToInsert);
    }

    // Handle co-tutors
    if (req.body.coTutorId && Array.isArray(req.body.coTutorId)) {
      // Save co-tutors in ClassCoTutors collection
      const coTutorsToInsert = req.body.coTutorId.map(coTutorId => ({
        classId: newClass._id,
        tutorId: coTutorId,
        status: constants.TUTOR_STATUS.PENDING
      }));
      await Model.ClassCoTutors.insertMany(coTutorsToInsert);

      // Send notifications
      req.body.coTutorId.forEach(coTutorId => {
        process.emit("sendNotification", {
          tutorId: coTutorId,
          receiverId: coTutorId,
          values: {
            classId: newClass._id,
            tutorName: req.user.name,
            className: req.body.topic
          },
          role: constants.ROLE.TUTOR,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.COTUTOR
        });
        process.emit("newClass", {
          tutorId: coTutorId,
          classId: newClass._id,
          tutorName: req.user.name,
          className: req.body.topic
        });
      });
    }
    return res.success(constants.MESSAGES[lang].SUCCESS, newClass);
  } catch (error) {
    console.error('Error creating class:', error);
    next(error);
  }
};
module.exports.getClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};

    if (req.query.setting) {
      qry.setting = Number(req.query.setting);
    }
    if (req.query.canBePrivate) {
      qry.canBePrivate = true;
    }

    const coTutorClasses = await Model.ClassCoTutors.find({
      tutorId: req.user._id,
      status: constants.TUTOR_STATUS.ACCEPTED
    }).select("classId");

    const coTutorClassIds = coTutorClasses.map(c => c.classId).filter(Boolean);

    pipeline.push({
      $match: {
        $or: [
          { tutorId: req.user._id },
          { _id: { $in: coTutorClassIds } }
        ],
        isDeleted: false,
        ...qry
      }
    });

    pipeline.push({
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $unwind: {
          path: "$subjects",
          preserveNullAndEmptyArrays: true
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "bookings",
          let: { classId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$bookClassId", "$$classId"] } } },
            { $limit: 1 }
          ],
          as: "userBookings"
        }
      },
      {
        $addFields: {
          isClassBooked: {
            $gt: [{ $size: { $ifNull: ["$userBookings", []] } }, 0]
          },
          isCoTutor: { $in: ["$_id", coTutorClassIds] }
        }
      },
      {
        $project: {
          thumbnail: 1,
          topic: 1,
          description: 1,
          fees: 1,
          "subjects._id": 1,
          "subjects.name": 1,
          grades: 1,
          updatedAt: 1,
          setting: 1,
          isFreeLesson: 1,
          typeOfClass: 1,
          payment: 1,
          duration: 1,
          currency: 1,
          classMode: 1,
          usdPrice: 1,
          dyteMeeting: 1,
          isClassBooked: 1,
          isCoTutor: 1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    let [classes] = await Model.Classes.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classes);
  } catch (error) {
    next(error);
  }
};
module.exports.getClassById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];
    pipeline.push({
        $match: {
          _id: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $unwind: {
          path: "$subjects",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "classcotutors",
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$classId", "$$classId"] }
              }
            },{
              $lookup: {
                from: "users",
                localField: "tutorId",
                foreignField: "_id",
                as: "tutorInfo"
              }
            },
            { $unwind: "$tutorInfo" },
            {
              $project: {
                _id: 0,
                status: 1,
                tutorId: "$tutorInfo._id",
                name: "$tutorInfo.name",
                profileImage: "$tutorInfo.profileImage"
              }
            }],
          as: "coTutors"
        }
      },{
        $lookup: {
          from: "classslots",
          localField: "_id",
          foreignField: "classId",
          as: "classslots"
        }
      },{
        $lookup: {
          from: "promocodes",
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $in: ["$$classId", "$classIds"] },
                isDeleted: false
              }
            },{
              $project: {
                name: 1,
                codeName: 1,
                discount: 1,
                discountType: 1,
                maxUser: 1,
                expiryDate: 1,
                startDate: 1,
                allClasses: 1,
                setting: 1
              }
            }
          ],
          as: "promoCodes"
        }
      },{
        $lookup: {
          from: "bookings",
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$bookClassId", "$$classId"] },
              }
            },
            { $limit: 1 }
          ],
          as: "userBookings"
        }
      },{
        $addFields: {
          isClassBooked: {
          $gt: [ { $size: { $ifNull: ["$userBookings", []] } }, 0 ]
        }
      }
    },{
      $project: {
        thumbnail: 1,
        teaser: 1,
        topic: 1,
        description: 1,
        objective: 1,
        fees: 1,
        address: 1,
        latitude: 1,
        longitude: 1,
        selectedSlots: 1,
        grades: 1,
        "subjects._id": 1,
        "subjects.name": 1,
        "tutor.name": 1,
        "coTutors.tutorId": 1,
        "coTutors.name": 1,
        "coTutors.userName": 1,
        "coTutors.image": 1,
        "coTutors.status": 1,
        promoCodes: 1,
        dyteMeeting: 1,
        seats: 1,
        allOutcome: 1,
        mostOutcome: 1,
        someOutcome: 1,
        material: 1,
        language: 1,
        notes: 1,
        canBePrivate: 1,
        classMode: 1,
        classslots: 1,
        searchTags: 1,
        createdAt: 1,
        setting: 1,
        isFreeLesson: 1,
        typeOfClass: 1,
        payment: 1,
        duration: 1,
        continueFor: 1,
        repeatEvery: 1,
        currency: 1,
        usdPrice: 1,
        isClassBooked: 1
      }
    });
    let [classes] = await Model.Classes.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classes);
  } catch (error) {
    next(error);
  }
};
module.exports.updateClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateClass.validateAsync(req.body);

    const classData = await Model.Classes.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!classData) {
      throw new Error(constants.MESSAGES[lang].CLASS_NOT_FOUND);
    }

    const classBooked = await Model.Booking.exists({
      bookClassId: ObjectId(req.params.id),
      bookType: constants.BOOK_TYPE.CLASS
    });
    if (classBooked) {
      throw new Error(constants.MESSAGES[lang].CLASS_ALREADY_BOOKED);
    }

    const { classSlots, promoCodeId, payment, coTutorId = [], ...updateFields } = req.body;

    // Handle slot dates
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      const slotDates = classSlots.map(slot => new Date(slot.date));
      updateFields.lastDate = new Date(Math.max(...slotDates));
      updateFields.startDate = new Date(Math.min(...slotDates));
    }

    // Calculate fees
    if (payment == constants.CLASS_PAYMENT.PER_HOUR) {
      let hour = req.body.duration / 60;
      updateFields.totalFees = req.body.fees * hour;
    } else if (payment == constants.CLASS_PAYMENT.SESSION) {
      updateFields.totalFees = req.body.fees;
    }

    // Update class details
    const updatedClass = await Model.Classes.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { $set: updateFields },
      { new: true }
    );

    // Update promo codes
    if (Array.isArray(promoCodeId) && promoCodeId.length > 0) {
      for (let promoId of promoCodeId) {
        await Model.PromoCode.updateOne(
          { _id: promoId, tutorId: req.user._id, isDeleted: false },
          { $addToSet: { classIds: ObjectId(req.params.id) } }
        );
      }
    }

    // Update slots
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      await Model.ClassSlots.deleteMany({ classId: ObjectId(req.params.id) });
      const newSlots = classSlots.map(slot => ({
        ...slot,
        classId: ObjectId(req.params.id),
        tutorId: req.user._id,
        seats: updatedClass.seats,
        remainingSeats: updatedClass.seats,
        timezone: req.body.timezone || "UTC"
      }));
      await Model.ClassSlots.insertMany(newSlots);
    }

    // 🔹 Update co-tutors (sync logic)
    const existingCoTutors = await Model.ClassCoTutors.find(
      { classId: updatedClass._id },
      { tutorId: 1 }
    ).lean();

    const existingTutorIds = existingCoTutors.map(ct => String(ct.tutorId));
    const newTutorIds = coTutorId.map(id => String(id));

    // Tutors to add
    const tutorsToAdd = newTutorIds.filter(id => !existingTutorIds.includes(id));
    // Tutors to remove
    const tutorsToRemove = existingTutorIds.filter(id => !newTutorIds.includes(id));

    // Add new co-tutors
    if (tutorsToAdd.length > 0) {
      const coTutorsToInsert = tutorsToAdd.map(tutorId => ({
        classId: updatedClass._id,
        tutorId: ObjectId(tutorId),
        status: constants.TUTOR_STATUS.PENDING
      }));
      await Model.ClassCoTutors.insertMany(coTutorsToInsert);

      tutorsToAdd.forEach(tutorId => {
        process.emit("sendNotification", {
          tutorId,
          receiverId: tutorId,
          values: {
            classId: updatedClass._id,
            tutorName: req.user.name,
            className: updatedClass.topic
          },
          role: constants.ROLE.TUTOR,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.COTUTOR
        });
      });
    }

    // Remove co-tutors not in list
    if (tutorsToRemove.length > 0) {
      await Model.ClassCoTutors.deleteMany({
        classId: updatedClass._id,
        tutorId: { $in: tutorsToRemove }
      });
    }

    // Notify remaining co-tutors (that weren’t removed)
    const notifyTutorIds = newTutorIds.filter(id => !tutorsToAdd.includes(id));
    notifyTutorIds.forEach(tutorId => {
      process.emit("sendNotification", {
        tutorId,
        receiverId: tutorId,
        values: {
          classId: updatedClass._id,
          tutorName: req.user.name,
          className: updatedClass.topic
        },
        role: constants.ROLE.TUTOR,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.CLASS_UPDATED
      });
    });

    return res.success(
      constants.MESSAGES[lang].CLASS_DETAILS_UPDATED_SUCCESSFULLY,
      updatedClass
    );

  } catch (error) {
    next(error);
  }
};

module.exports.deleteClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    const classData = await Model.Classes.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!classData) {
      throw new Error(constants.MESSAGES[lang].CLASS_NOT_FOUND);
    }
    const classBooked = await Model.Booking.exists({
      bookClassId: ObjectId(req.params.id),
      bookType: constants.BOOK_TYPE.CLASS
    });
    if (classBooked) {
      throw new Error(constants.MESSAGES[lang].CLASS_ALREADY_BOOKED);
    }

    const doc = await Model.Classes.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { isDeleted: true },
      { new: true }
    );
    await Model.ClassSlots.deleteMany({ classId: ObjectId(req.params.id) });
    return res.success(
      constants.MESSAGES[lang].CLASS_DETAIL_DELETED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};
module.exports.classSlots = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    let classDetails = await Model.Classes.findById(req.params.id)
    .select("totalFees duration");

    pipeline.push({
        $match: {
          classId: ObjectId(req.params.id)
        }
      },{
        $project: {
          date: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          remainingSeats: 1
        }
      });
    let classSlots = await Model.ClassSlots.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      classSlots, classDetails});
  } catch (error) {
    next(error);
  }
};
module.exports.updateSlotsStatus = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateSlotStatus.validateAsync(req.body);

    let slotIds = req.body.slotIds;
    await Model.ClassSlots.updateMany(
      { _id: { $in: slotIds.map(id => ObjectId(id)) } },
      { $set: { status: req.body.status } }
    );
    return res.success(
      constants.MESSAGES[lang].CLASS_SLOT_STATUS_UPDATED_SUCCESSFULLY,
      {}
    );

  } catch (error) {
    next(error);
  }
};

//Content
module.exports.createContent = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Tutor.addContent.validateAsync(req.body);
    req.body.userId = req.user._id;
    req.body.createdBy = constants.APP_ROLE.TUTOR;
    const content = await Model.Content.create(req.body);

    if (req.body.options && Array.isArray(req.body.options) && req.body.options.length > 0) {
      const pollOptions = req.body.options.map(option => ({
        contentId: content._id,
        option
      }));
      await Model.PollOptions.insertMany(pollOptions);
    }

    let admin = await Model.Admin.findOne();
    let pushType;
    switch (req.body.contentType) {
      case constants.CONTENT_TYPE.FORUM:
        pushType = constants.PUSH_TYPE_KEYS.FORUM;
        break;
      case constants.CONTENT_TYPE.SHORT_VIDEO:
        pushType = constants.PUSH_TYPE_KEYS.SHORT_VIDEO;
        break;
      case constants.CONTENT_TYPE.TEASER_VIDEO:
        pushType = constants.PUSH_TYPE_KEYS.TEASER_VIDEO;
        break;
      case constants.CONTENT_TYPE.POST:
        pushType = constants.PUSH_TYPE_KEYS.POST;
        break;
      default:
        pushType = constants.PUSH_TYPE_KEYS.DEFAULT;
    }

    process.emit("sendNotification", {
      adminId: admin._id,
      receiverId: admin._id,
      values: {
        name: req.user.name,
        contentType: req.body.contentType
      },
      role: constants.ROLE.ADMIN,
      isNotificationSave: true,
      pushType
    });

    const followers = await Model.Follow.find({
      tutorId: req.user._id
    }).select("parentId");

    const parentIds = followers.map(f => f.parentId).filter(Boolean);

    for (const parentId of parentIds) {
      process.emit("sendNotification", {
        parentId: parentId,
        receiverId: parentId,
        values: {
          name: req.user.name,
          contentType: req.body.contentType,
          contentId: content._id
        },
        role: constants.ROLE.PARENT,
        isNotificationSave: true,
        pushType
      });
    }

    return res.success(constants.MESSAGES[lang].CONTENT_CREATED, content);
  } catch (error) {
    next(error);
  }
};

const getContentAggregationPipeline = ({ matchCondition = {}, userId, sortType, search }) => {
  const pipeline = [];
   pipeline.push({ $match: matchCondition });
   pipeline.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user"
      }
    },{
      $unwind: {
        path: "$user",
        preserveNullAndEmptyArrays: false
      }
    });


  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "category"
    }
  },{
    $unwind: {
      path: "$category",
      preserveNullAndEmptyArrays: true
    }
  },{
    $lookup: {
      from: "subjects",
      localField: "subjectId",
      foreignField: "_id",
      as: "subjects"
    }
  });

  pipeline.push({
    $lookup: {
      from: "polloptions",
      localField: "_id",
      foreignField: "contentId",
      as: "pollOptions"
    }
  });

  if (search) {
    const searchRegex = new RegExp(search.trim(), 'i');
    pipeline.push({
      $match: {
        $or: [
          { title: searchRegex },
          { topic: searchRegex },
          { "subjects.name": searchRegex },
          { "category.name": searchRegex }
        ]
      }
    });
  }

  // User Engagements
  pipeline.push({
    $lookup: {
      from: "engagements",
      let: { contentId: "$_id" },
      pipeline: [{
          $match: {
            $expr: {
              $and: [
                { $eq: ["$contentId", "$$contentId"] },
                { $eq: ["$userId", ObjectId(userId)] }
              ]
            }
          }
        }],
      as: "userEngagements"
    }
  });

  pipeline.push({
    $addFields: {
      isUpvote: {
        $gt: [{
          $size: {
            $filter: {
              input: "$userEngagements",
              as: "eng",
              cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.UPVOTE] }
            }
          }
        }, 0]
      },
      isDownvote: {
        $gt: [{
          $size: {
            $filter: {
              input: "$userEngagements",
              as: "eng",
              cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.DOWNVOTE] }
            }
          }
        }, 0]
      },
      isLike: {
        $gt: [{
          $size: {
            $filter: {
              input: "$userEngagements",
              as: "eng",
              cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.LIKE] }
            }
          }
        }, 0]
      },
      isSave: {
        $gt: [{
          $size: {
            $filter: {
              input: "$userEngagements",
              as: "eng",
              cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.SAVE] }
            }
          }
        }, 0]
      }
    }
  });

   // 🔹 lookup user poll vote
    pipeline.push({
    $lookup: {
      from: "pollvotes",
      let: { contentId: "$_id", uId: ObjectId(userId) },
      pipeline: [
        {
          $lookup: {
            from: "polloptions",
            localField: "pollOptionId",
            foreignField: "_id",
            as: "option"
          }
        },
        { $unwind: "$option" },
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$userId", "$$uId"] },
                { $eq: ["$option.contentId", "$$contentId"] }
              ]
            }
          }
        },
        { $project: { pollOptionId: 1 } }
      ],
      as: "userVote"
    }
  });

  pipeline.push({
    $addFields: {
      userVotedOptionId: {
        $cond: [
          { $gt: [{ $size: "$userVote" }, 0] },
          { $arrayElemAt: ["$userVote.pollOptionId", 0] },
          null
        ]
      }
    }
  });

  pipeline.push({
    $project: {
      images: 1,
      title: 1,
      topic: 1,
      description: 1,
      gradeId: 1,
      "subjects._id": 1,
      "subjects.name": 1,
      "category._id": 1,
      "category.name": 1,
      language: 1,
      views: 1,
      upVoteCount: 1,
      downVoteCount: 1,
      likeCount: 1,
      commentCount: 1,
      shareCount: 1,
      saveCount: 1,
      createdAt: 1,
      createdBy: 1,
      isUpvote: 1,
      isDownvote: 1,
      isLike: 1,
      isSave: 1,
      allowComments: 1,
      visibility: 1,
      isAnonymous: 1,
      uploadType: 1,
      giftCount: 1,
      question: 1,
      duration: 1,
      votesCount: 1,
      "user._id": 1,
      "user.image": 1,
      "user.name": 1,
      "user.userName": 1,
      "user.followers": 1,
      "pollOptions._id": 1,
      "pollOptions.option": 1,
      "pollOptions.votes": 1,
      userVotedOptionId: 1,
      contentType: 1
    }
  });

  if (sortType == constants.SORT_TYPE.LATEST) {
    pipeline.push({ $sort: { createdAt: -1 } });
  } else if (sortType == constants.SORT_TYPE.OLDEST) {
    pipeline.push({ $sort: { createdAt: 1 } });
  }
  return pipeline;
};
module.exports.getContent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    let match = {
      isDeleted: false,
      userId: req.user._id,
      contentType: Number(req.query.contentType)
    };

    if(req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      match.$or = [
        { title: searchRegex },
        { "subjects.name": searchRegex }
      ];
    }

    if(req.query.setting){
      match.setting = Number(req.query.setting);
    }

    if(req.query.categoryId){
      match.categoryId = ObjectId(req.query.categoryId);
    }
    if (req.query.subjectId) {
      match.subjectId = { $in: [ObjectId(req.query.subjectId)] };
    }
    if(req.query.grade){
      match.gradeId = Number(req.query.grade);
    }
    if(req.query.uploadType){
      match.uploadType = Number(req.query.uploadType);
    }

    let pipeline = getContentAggregationPipeline({
      matchCondition: match,
      userId: req.user._id,
      sortType: Number(req.query.sortBy),
      search: req.query.search
    });

    pipeline = await common.pagination(pipeline, skip, limit);
    const [content] = await Model.Content.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.getContentById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    let pipeline = getContentAggregationPipeline({
      matchCondition: { _id: ObjectId(req.params.id),
        isDeleted: false
       },
      userId: req.user._id
    });
    const [content] = await Model.Content.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.updateContent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.updateContent.validateAsync(req.body);

    const contentData = await Model.Content.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!contentData) {
      throw new Error(constants.MESSAGES[lang].CONTENT_NOT_FOUND);
    }

    const updatedContent = await Model.Content.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { $set: req.body },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].CONTENT_UPDATED_SUCCESSFULLY,
      updatedContent
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deleteContent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const contentData = await Model.Content.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!contentData) {
      throw new Error(constants.MESSAGES[lang].CONTENT_NOT_FOUND);
    }

    contentData.isDeleted = true;
    contentData.save();

    return res.success(
      constants.MESSAGES[lang].CONTENT_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};

//Content Engagements
module.exports.engage = async (req, res, next) => {
  let lang = req.headers.lang || "en";
  await Validation.Parent.engage.validateAsync(req.body);

  const { engagementType, commentText } = req.body;
  const userId = req.user._id;
  const contentId = ObjectId(req.body.contentId);

  const postDoc = await Model.Content.findById(contentId);
  if (!postDoc) throw new Error(constants.MESSAGES[lang].CONTENT_NOT_FOUND);

  const engagementFilter = {
    userId,
    engagementType,
    contentId
  };

  const existingEngagement = await Model.Engagement.findOne(engagementFilter);

  let updateQuery = {};

  switch (engagementType) {
   case constants.ENGAGEMENTS.UPVOTE: {
  const previousVote = await Model.Engagement.findOne({
    userId,
    contentId,
    engagementType: { $in: [constants.ENGAGEMENTS.UPVOTE, constants.ENGAGEMENTS.DOWNVOTE] }
  });

  if (previousVote) {
    await Model.Engagement.deleteOne({ _id: previousVote._id });

    if (previousVote.engagementType == constants.ENGAGEMENTS.UPVOTE) {
      updateQuery = { $inc: { upVoteCount: -1 } };
    } else {
      await Model.Engagement.create({ userId, engagementType, contentId });
      updateQuery = { $inc: { downVoteCount: -1, upVoteCount: 1 } };
    }
  } else {
    await Model.Engagement.create({ userId, engagementType, contentId });
    updateQuery = { $inc: { upVoteCount: 1 } };
  }
  break;
}

case constants.ENGAGEMENTS.DOWNVOTE: {
  const previousVote = await Model.Engagement.findOne({
    userId,
    contentId,
    engagementType: { $in: [constants.ENGAGEMENTS.UPVOTE, constants.ENGAGEMENTS.DOWNVOTE] }
  });

  if (previousVote) {
    await Model.Engagement.deleteOne({ _id: previousVote._id });

    if (previousVote.engagementType == constants.ENGAGEMENTS.DOWNVOTE) {
      updateQuery = { $inc: { downVoteCount: -1 } };
    } else {
      await Model.Engagement.create({ userId, engagementType, contentId });
      updateQuery = { $inc: { upVoteCount: -1, downVoteCount: 1 } };
    }
  } else {
    await Model.Engagement.create({ userId, engagementType, contentId });
    updateQuery = { $inc: { downVoteCount: 1 } };
  }
  break;
}

    case constants.ENGAGEMENTS.LIKE:
      if (existingEngagement) {
        await Model.Engagement.deleteOne({ _id: existingEngagement._id });
        updateQuery = { $inc: { likeCount: -1 } };
      } else {
        await Model.Engagement.create({ userId, engagementType, contentId });
        updateQuery = { $inc: { likeCount: 1 } };
      }
      break;

    case constants.ENGAGEMENTS.SAVE:
      if (existingEngagement) {
        await Model.Engagement.deleteOne({ _id: existingEngagement._id });
        updateQuery = { $inc: { saveCount: -1 } };
      } else {
        await Model.Engagement.create({ userId, engagementType, contentId });
        updateQuery = { $inc: { saveCount: 1 } };
      }
      break;

    case constants.ENGAGEMENTS.SHARE:
      await Model.Engagement.create({ userId, engagementType, contentId });
      updateQuery = { $inc: { shareCount: 1 } };
      break;

    case constants.ENGAGEMENTS.COMMENT:{
      if (!commentText || commentText.trim() === "") {
        throw new Error(constants.MESSAGES[lang].COMMENT_TEXT_REQUIRED);
      }
      const commentPayload = {
        userId,
        contentId,
        commentText
      };

      await Model.Comment.create(commentPayload);
      updateQuery = { $inc: { commentCount: 1 } };
      break;
    }

    default:
      throw new Error(constants.MESSAGES[lang].INVALID_ENGAGEMENT_TYPE);
  }

  if (Object.keys(updateQuery).length) {
    await Model.Content.updateOne({ _id: contentId }, updateQuery);
  }

  return res.success(constants.MESSAGES[lang].ENGAGEMENT_SUCCESS, {
    contentId,
    engagementType
  });
};
module.exports.commentEngagement = async (req, res, next) => {
  let lang = req.headers.lang || "en";
  await Validation.Parent.commentEngage.validateAsync(req.body);

  const { reply, type } = req.body;
  const userId = req.user._id;
  const commentId = ObjectId(req.body.commentId);

  if (!commentId) {
    throw new Error("Comment ID is required");
  }

  switch (type) {
    case constants.COMMENT_ENGAGEMENTS.REPLY:
      if (!reply || reply.trim() === "") {
        throw new Error("Reply text is required");
      }
      await Model.CommentReply.create({ userId, commentId, reply });
      break;

    case constants.COMMENT_ENGAGEMENTS.LIKE: {
      const existingLike = await Model.CommentLike.findOne({ userId, commentId });

      if (existingLike) {
        await Model.CommentLike.deleteOne({ _id: existingLike._id });
        await Model.Comment.updateOne(
          { _id: commentId },
          { $inc: { likeCount: -1 } }
        );
      } else {
        await Model.CommentLike.create({ userId, commentId });
        await Model.Comment.updateOne(
          { _id: commentId },
          { $inc: { likeCount: 1 } }
        );
      }
      break;
    }
    default:
      throw new Error(constants.MESSAGES[lang].INVALID_ENGAGEMENT_TYPE);
  }

  return res.success(constants.MESSAGES[lang].ENGAGEMENT_SUCCESS, {
    commentId, type
  });
};
module.exports.getComments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    let pipeline = [{
        $match: {
          contentId: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },{
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "commentreplies",
          let: { commentId: "$_id" },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$commentId", "$$commentId"]
                }
              }
            },{
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "replyUser"
              }
            },{
              $unwind: {
                path: "$replyUser",
                preserveNullAndEmptyArrays: true
              }
            },{
              $project: {
                _id: 1,
                commentId: 1,
                reply: 1,
                createdAt: 1,
                updatedAt: 1,
                replyUser: {
                  _id: "$replyUser._id",
                  name: "$replyUser.name",
                  userName: "$replyUser.userName",
                  image: "$replyUser.image"
                }
              }
            }],
          as: "commentReply"
        }
      },{
        $lookup: {
          from: "commentlikes",
          let: { commentId: "$_id" },
          pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$commentId", "$$commentId"] },
                    { $eq: ["$userId", ObjectId(userId)] }
                  ]
                }
              }
            }],
          as: "userLike"
        }
      },{
        $addFields: {
          isLiked: {
            $cond: [{ $gt: [{ $size: "$userLike" }, 0] }, true, false]
          }
        }
      },{
        $sort: { createdAt: -1 }
      },{
        $project: {
          _id: 1,
          commentText: 1,
          createdAt: 1,
          isLiked: 1,
          commentReply: 1,
          likeCount: 1,
          "user._id": 1,
          "user.name": 1,
          "user.userName": 1,
          "user.image": 1
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    const [comments] = await Model.Comment.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, comments);
  } catch (error) {
    next(error);
  }
};

//Promo Codes
module.exports.addPromoCode = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addPromoCode.validateAsync(req.body);

    let codeName = req.body.codeName;

    if (codeName) {
      const existingPromo = await Model.PromoCode.findOne({
        codeName: { $regex: new RegExp(`^${codeName.trim()}$`, "i") },
        tutorId: req.user._id,
        isDeleted: false
      });
      if (existingPromo) {
        throw new Error(constants.MESSAGES[lang].PROMO_NAME_EXISTS);
      }
    } else {
      let unique = false;
      while (!unique) {
        const generated = functions.generatePromoCodeName(req.user.userName);
        const exists = await Model.PromoCode.findOne({
          codeName: generated,
          tutorId: req.user._id,
          isDeleted: false
        });
        if (!exists) {
          codeName = generated;
          unique = true;
        }
      }
    }
    req.body.codeName = codeName;
    req.body.tutorId = req.user._id;
    req.body.remainingCount = req.body.maxUser;
    const promocode = await Model.PromoCode.create(req.body);
    return res.success(constants.MESSAGES[lang].PROMO_ADDED_SUCCESSFULLY, promocode);
  } catch (error) {
    next(error);
  }
};
module.exports.getPromoCode = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};

   if(req.query.setting){
      qry.setting = Number(req.query.setting);
    }
    pipeline.push({
        $match: {
          tutorId: req.user._id,
          isDeleted: false,
          ...qry
        }
      },{
        $lookup: {
          from: "classes",
          localField: "classIds",
          foreignField: "_id",
          as: "classes"
        }
      },{
          $sort: {
            createdAt: -1
        }
      },{
        $project: {
          codeName: 1,
          name: 1,
          discountType: 1,
          discount: 1,
          maxUser: 1,
          usedCount: 1,
          startDate: 1,
          expiryDate: 1,
          type: 1,
          setting: 1,
          allClasses: 1,
          classes: {
            _id: 1,
            topic: 1
          },
          status: 1,
          updatedAt: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [promoCode] = await Model.PromoCode.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promoCode);
  } catch (error) {
    next(error);
  }
};
module.exports.getPromoCodeById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "classes",
          localField: "classIds",
          foreignField: "_id",
          as: "classes"
        }
      },{
        $project: {
          codeName: 1,
          name: 1,
          discountType: 1,
          discount: 1,
          maxUser: 1,
          usedCount: 1,
          startDate: 1,
          expiryDate: 1,
          type: 1,
          setting: 1,
          allClasses: 1,
          status: 1,
           classes: {
            _id: 1,
            topic: 1
          },
          createdAt: 1
        }
      });
    let [promocode] = await Model.PromoCode.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promocode);
  } catch (error) {
    next(error);
  }
};
module.exports.updatePromoCode = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.updatePromoCode.validateAsync(req.body);

    const promoId = ObjectId(req.params.id);

    const promocode = await Model.PromoCode.findOne({
      _id: promoId,
      tutorId: req.user._id,
      isDeleted: false
    });

    if (!promocode) {
      throw new Error(constants.MESSAGES[lang].PROMOCODE_NOT_FOUND);
    }

    if (req.body.codeName && req.body.codeName.trim()) {
      const duplicateName = await Model.PromoCode.findOne({
        _id: { $ne: promoId },
        codeName: { $regex: new RegExp(`^${req.body.codeName.trim()}$`, "i") },
        tutorId: req.user._id,
        isDeleted: false
      });

      if (duplicateName) {
        throw new Error(constants.MESSAGES[lang].PROMO_NAME_EXISTS);
      }
    }

    if (req.body.maxUser) {
      const newMaxUser = req.body.maxUser;
      const oldMaxUser = promocode.maxUser;

      if (newMaxUser < oldMaxUser) {
        if (promocode.usedCount > newMaxUser) throw new Error (
        `You cannot set max users to ${newMaxUser} because ${promocode.usedCount} users have already used this promo code.`
      );
      }
    }
    const updatedPromoCode = await Model.PromoCode.findOneAndUpdate(
      { _id: promoId },
      { $set: req.body },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].PROMO_CODE_UPDATED_SUCCESSFULLY,
      updatedPromoCode
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deletePromoCode = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const classData = await Model.PromoCode.findOne({
      _id: ObjectId(req.params.id),
      tutorId: req.user._id,
      isDeleted: false
    });
    if (!classData) {
      throw new Error(constants.MESSAGES[lang].PROMOCODE_NOT_FOUND);
    }
    await Model.PromoCode.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { isDeleted: true },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].PROMOCODE_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};
module.exports.promoDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    let active = await Model.PromoCode.countDocuments({
      tutorId: req.user._id,
      isDeleted: false,
      setting: constants.SETTING.PUBLISH
    });

    let draft = await Model.PromoCode.countDocuments({
      tutorId: req.user._id,
      isDeleted: false,
      setting: constants.SETTING.DRAFT
    });

    const promoCodes = await Model.PromoCode.find({ tutorId: req.user._id }).select('_id');
    const promoCodeIds = promoCodes.map(promo => promo._id);

    const uses = await Model.Booking.countDocuments({
      tutorId: req.user._id,
      promocodeId: { $in: promoCodeIds, $ne: null, $exists: true }
    });

    const revenueWithPromo = await Model.Booking.aggregate([
      {
        $match: {
          tutorId: req.user._id,
          promocodeId: { $ne: null }
        }
      },{
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);
    const totalRevenue = await Model.Booking.aggregate([
      {
        $match: {
          tutorId: req.user._id
        }
      },{
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);

    const revenueWith = revenueWithPromo[0]?.total || 0;
    const revenueAll = totalRevenue[0]?.total || 0;

    let boostPercentage = 0;
    if (revenueAll > 0) {
      boostPercentage = (revenueWith / revenueAll) * 100;
    }

    return res.success(
      constants.MESSAGES[lang].DATA_FETCHED,
      {
        active,
        draft,
        uses,
        boostPercentage
      });

  } catch (error) {
    next(error);
  }
};

//Social Media links
module.exports.createSocialLinks = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Tutor.addSocialLinks.validateAsync(req.body);

    req.body.tutorId = req.user._id;
    const socialLink = await Model.SocialLinks.create(req.body);
    return res.success(constants.MESSAGES[lang].SOCIAL_LINK_ADDED_SUCCESSFULLY, socialLink);
  } catch (error) {
    next(error);
  }
};
module.exports.getSocialLinks = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];

    pipeline.push({
        $match: {
          tutorId: req.user._id,
          isDeleted: false
        }
      },{
          $sort: {
            createdAt: -1
        }
      },{
        $project: {
          type: 1,
          title: 1,
          link: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [socialLink] = await Model.SocialLinks.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, socialLink);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteSocialLinks = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    const socialLink = await Model.SocialLinks.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!socialLink) {
      throw new Error(constants.MESSAGES[lang].SOCIAL_LINK_NOT_FOUND);
    }

    socialLink.isDeleted = true;
    socialLink.save();

    return res.success(
      constants.MESSAGES[lang].SOCIAL_LINK_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};

//Class Booking
module.exports.classBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          bookType: constants.BOOK_TYPE.CLASS
        }
      },{
        $lookup: {
          from: "classes",
          localField: "bookClassId",
          foreignField: "_id",
          as: "classData"
        }
      },{
        $unwind: "$classData"
      }];

    pipeline.push( {
    $lookup: {
      from: "classcotutors",
      let: { classId: "$classData._id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$classId", "$$classId"] },
            tutorId: req.user._id,
            status: constants.TUTOR_STATUS.ACCEPTED
          }
        }
      ],
      as: "coTutorCheck"
    }
  },{
    $match: {
      $or: [
        { tutorId: req.user._id },
        { "coTutorCheck.0": { $exists: true } }
      ]
    }
  });

    if (req.query.classMode) {
      pipeline.push({
        $match: {
          "classData.classMode": Number(req.query.classMode)
        }
      });
    }

    pipeline.push({
        $lookup: {
          from: "classslots",
          localField: "classSlotIds",
          foreignField: "_id",
          as: "classSlots"
        }
      },{
        $unwind: "$classSlots"
      },{
        $lookup: {
          from: "subjects",
          localField: "classData.subjectId",
          foreignField: "_id",
          as: "subjectId"
        }
      },{
        $unwind: {
          path: "$subjectId",
          preserveNullAndEmptyArrays: true
        }
      });

    if (req.query.date) {
      const formattedDate = moment.utc(req.query.date).format("YYYY-MM-DD");
      pipeline.push({
        $match: {
          $expr: {
            $eq: [
              { $dateToString: { format: "%Y-%m-%d", date: "$classSlots.date" } },
              formattedDate
            ]
          }
        }
      });
    }
    pipeline.push({
      $group: {
        _id: "$classSlots._id",
        classSlots: { $first: "$classSlots" },
        classData: { $first: "$classData" },
        subjectId: { $first: "$subjectId" }
      }
    });
    pipeline.push({
      $project: {
        classSlots: {
          _id: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          timezone: 1,
          seats: 1,
          remainingSeats: 1
        },
        classData: {
          _id: 1,
          tutorId: 1,
          topic: 1,
          dyteMeeting: 1,
          classMode: 1,
          address: 1,
          latitude: 1,
          longitude: 1
        },
        subjectId: {
          name: 1
        }
      }
    });
    const booking = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
  } catch (error) {
    next(error);
  }
};
module.exports.userBook = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;
    let pipeline = [{
        $match: {
          classSlotIds: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "user"
        }
      },{
        $unwind: "$user"
      },{
        $project: {
          "user.name": 1,
          "user.image": 1,
          "user.email": 1,
          createdAt: 1
        }
      }
    ];
    pipeline = await common.pagination(pipeline, skip, limit);
    const [users] = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, users );
  } catch (error) {
    next(error);
  }
};
module.exports.bookClassById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          _id: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parent"
        }
      },{
        $unwind: {
          path: "$parent",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "classslots",
          localField: "classSlotIds",
          foreignField: "_id",
          as: "classSlots"
        }
      },{
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classData"
        }
      },{
        $unwind: {
          path: "$classData",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "classData.subjectId",
          foreignField: "_id",
          as: "subjectId"
        }
      },{
        $unwind: {
          path: "$subjectId",
          preserveNullAndEmptyArrays: true
        }
      },{
        $sort: { createdAt: -1 }
      },{
        $project: {
          parent: { _id: 1, name: 1, image: 1 },
          subjectId: { name: 1 },
          createdAt: 1,
          grandTotal: 1,
          invoiceNo: 1,
          classModeOnline: 1,
          tutorMoney: 1,
          serviceType: 1,
          serviceCharges: 1,
          address: 1,
          bookingNumber: 1,
          classSlots: {
            date: 1,
            startTime: 1,
            endTime: 1,
            timezone: 1
          },
          classData: {
            topic: 1,
            description: 1,
            thumbnail: 1,
            fees: 1,
            language: 1,
            address: 1,
            classId: 1
          }
        }
      }];

    let [booking] = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
  } catch (error) {
    next(error);
  }
};

//Followers
module.exports.followers = async (req, res, next) => {
    try{
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let qry = {};
    let pipeline = [{
      $match: {
        tutorId: req.user._id
      }
    },{
      $lookup: {
        from: "users",
        localField: "parentId",
        foreignField: "_id",
        as: "parentId"
      }
    },{
      $unwind: {
        path: "$parentId",
        preserveNullAndEmptyArrays: false
      }
    },{
      $match: qry
    },{
      $project: {
        "parentId._id": 1,
        "parentId.image": 1,
        "parentId.name": 1,
        "parentId.dialCode": 1,
        "parentId.phoneNo": 1,
        "parentId.email": 1
      }
    }];

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "parentId.name": searchRegex
        }];
      }
    pipeline = await common.pagination(pipeline, skip, limit);
    let [follow] = await Model.Follow.aggregate(pipeline);
    await Model.Follow.updateMany(
      { tutorId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      followers: follow.data,
      totalFollowers: follow.total
    });
    }catch(error){
      next(error);
    }
};

//Viewers
module.exports.viewers = async (req, res, next) => {
    try{
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let qry = {};
    let pipeline = [{
      $match: {
        tutorId: req.user._id
      }
    },{
      $lookup: {
        from: "users",
        localField: "parentId",
        foreignField: "_id",
        as: "parentId"
      }
    }, {
      $unwind: {
        path: "$parentId",
        preserveNullAndEmptyArrays: false
      }
    },{
      $match: qry
    },{
      $project: {
        "parentId._id": 1,
        "parentId.image": 1,
        "parentId.name": 1,
        "parentId.dialCode": 1,
        "parentId.phoneNo": 1,
        "parentId.email": 1
      }
    }];

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "parentId.name": searchRegex
        }];
      }
    pipeline = await common.pagination(pipeline, skip, limit);
    let [viewers] = await Model.TutorViews.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      viewers: viewers.data,
      totalViewers: viewers.total
    });
    }catch(error){
      next(error);
    }
};

//Listings
module.exports.catSubList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const type = Number(req.query.type);
    let data;

    let qry = {};
    let search = req.query.search ? new RegExp(req.query.search, "i") : null;

    switch (type) {
      case constants.LISTING.CATEGORY:
        if (search) {
          qry.name = search;
        }
        data = await Model.Category.find({
          isDeleted: false,
          status: true,
          ...qry
        }).select("name");
        break;

      case constants.LISTING.SUBJECT:
        if (req.query.categoryId) {
          qry.categoryId = ObjectId(req.query.categoryId);
        }
        if (search) {
          qry.name = search;
        }
        data = await Model.Subjects.find({
          isDeleted: false,
          status: true,
          ...qry
        }).select("name");
        break;

      case constants.LISTING.TUTOR_SUBJECT: {
        const teachingDetail = await Model.TeachingDetails.findOne({
          tutorId: req.user._id
        });

        qry = {
          _id: { $in: teachingDetail.subjectIds },
          isDeleted: false,
          status: true
        };
        if (search) {
          qry.name = search;
        }

        data = await Model.Subjects.find(qry).select("name");
        break;
      }

      case constants.LISTING.CLASS:
        if (req.query.canBePrivate == "true") {
          qry.canBePrivate = true;
        } else if (req.query.canBePrivate == "false") {
          qry.canBePrivate = false;
        }
        if (search) {
          qry.topic = search;
        }
        data = await Model.Classes.find({
          tutorId: req.user._id,
          isDeleted: false,
          status: true,
          isFreeLesson: false,
          setting: constants.SETTING.PUBLISH,
          ...qry
        }).select("topic subjectId")
          .populate("subjectId", "name");
        break;

      default:
        return res.success(constants.MESSAGES[lang].DATA_FETCHED, []);
    }

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, data);
  } catch (error) {
    next(error);
  }
};

//Inquiry
module.exports.getInquiry = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};

    if(req.query.status){
      qry.status = Number(req.query.status);
    }

    pipeline.push({
        $match: {
          tutorId: req.user._id,
          isForward: true,
          isDeleted: false,
          ...qry
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parent"
        }
      },{
        $unwind: {
          path: "$parent",
          preserveNullAndEmptyArrays: true
        }
      },{
          $sort: {
            createdAt: -1
        }
      },{
        $project: {
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          name: 1,
          email: 1,
          revert: 1,
          tutorRevert: 1,
          type: 1,
          status: 1,
          other: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [inquiry] = await Model.Inquiry.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, inquiry);
  } catch (error) {
    next(error);
  }
};
module.exports.inquiryRevert = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.inquiryRevert.validateAsync(req.body);

    let findInquiry = await Model.Inquiry.findByIdAndUpdate(req.body.inquiryId,{
      $set: {
        tutorRevert: req.body.tutorRevert,
        status: constants.INQUIRY_STATUS.ACCEPTED
      }
    },{
      new : true
    });
    return res.success(constants.MESSAGES[lang].REVERT_FOR_INQUIRY, findInquiry);
  } catch (error) {
    next(error);
  }
};
module.exports.getInquiryById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parent"
        }
      },{
        $unwind: {
          path: "$parent",
          preserveNullAndEmptyArrays: true
        }
      },{
        $project: {
         "parent.image": 1,
         "parent.name": 1,
          name: 1,
          email: 1,
          type: 1,
          status: 1,
          other: 1,
          revert: 1,
          tutorRevert: 1,
          createdAt: 1
        }
      });
    let [inquiry] = await Model.Inquiry.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, inquiry);
  } catch (error) {
    next(error);
  }
};

//Gifts
module.exports.gifts = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;
    let pipeline = [];
    let giftAmount = 0;
    let qry = {};
    if (req.query.contentId) {
      qry.contentId = ObjectId(req.query.contentId);
      const content = await Model.Content.findById(req.query.contentId);
      giftAmount = content?.giftsEarn || 0;
    } else {
      pipeline.push({
          $lookup: {
            from: "contents",
            localField: "contentId",
            foreignField: "_id",
            as: "content"
          }
        },{
          $unwind: {
            path: "$content",
            preserveNullAndEmptyArrays: false
          }
        },{
          $match: {
            "content.userId": req.user._id
          }
        },{
          $lookup: {
            from: "subjects",
            localField: "content.subjectId",
            foreignField: "_id",
            as: "subject"
          }
        },{
          $unwind: {
            path: "$subject",
            preserveNullAndEmptyArrays: true
          }
        });
      }

    pipeline.push({
        $match: qry
      },{
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },{
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },{
        $project: {
          "user.image": 1,
          "user.name": 1,
          "content.contentType": 1,
          "content.title": 1,
          "content.topic": 1,
          "content.gradeId": 1,
          "subject.name": 1,
          amount: 1,
          note: 1,
          createdAt: 1
        }
      },{
        $sort: {
          createdAt: -1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    let [gift] = await Model.Gifts.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      giftAmount,
      gift
    });
  } catch (error) {
    next(error);
  }
};

//Block Report Chat
module.exports.blockReportChat = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.blockChat.validateAsync(req.body);
    req.body.tutorId = req.user._id;
    req.body.reportBy = constants.APP_ROLE.TUTOR;
    if(req.body.type == constants.CHAT_REPORT.REPORT){
      const reportChat = await Model.ReportChat.create(req.body);
      return res.success(constants.MESSAGES[lang].CHAT_REPORT_SUCCESSFULLY, reportChat);
    }else if(req.body.type == constants.CHAT_REPORT.BLOCK){
      await Model.ChatMessage.updateMany({
        connectionId: req.body.chatId
      },{
        isParentBlocked: true
      });
      const reportChat = await Model.ReportChat.create(req.body);
      return res.success(constants.MESSAGES[lang].CHAT_BLOCKED_SUCCESSFULLY, reportChat);
    }else if(req.body.type == constants.CHAT_REPORT.UNBLOCK){
          await Model.ChatMessage.updateMany({
            connectionId: req.body.chatId
          },{
            isParentBlocked: false
          });
          return res.success(constants.MESSAGES[lang].CHAT_UNBLOCKED_SUCCESSFULLY, {});
        }
  } catch (error) {
    next(error);
  }
};

module.exports.agreeChat = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.agreeChat.validateAsync(req.body);

    let agreeChat = await Model.ChatAgreement.findOne({
      chatId: req.body.chatId
    });
    if(agreeChat){
      agreeChat.tutor = true;
      agreeChat.save();
    }else{
      req.body.tutor = true;
      agreeChat = await Model.ChatAgreement.create(req.body);
    }
    return res.success(constants.MESSAGES[lang].I_UNDERSTAND, agreeChat);

  } catch (error) {
    next(error);
  }
};
module.exports.subjectList = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const { categoryId } = req.body;

    let query = {
      categoryId: { $in: categoryId },
      status: true,
      isDeleted: false
    };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      query.name = searchRegex;
    }

    const subjects = await Model.Subjects.find(query);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, subjects);
  } catch (error) {
    next(error);
  }
};

module.exports.pollResult = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";

    const pollOptions = await Model.PollOptions.find({
      contentId: ObjectId(req.params.id)
    });
    const content = await Model.Content.findById(req.params.id, { votesCount: 1 });
    const totalVotes = content?.votesCount || 0;

    const results = pollOptions.map(opt => ({
      _id: opt._id,
      option: opt.option,
      votes: opt.votes,
      percentage: totalVotes > 0 ? ((opt.votes / totalVotes) * 100).toFixed(2) : "0.00"
    }));

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      totalVotes,
      results
    });
  } catch (error) {
    next(error);
  }
};

module.exports.usersVoted = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;
    const { contentId, pollOptionId } = req.query;
    let matchStage = {};
    if (pollOptionId) {
      matchStage.pollOptionId = ObjectId(pollOptionId);
    } else if (contentId) {
      matchStage = {};
    }

    let pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "polloptions",
          localField: "pollOptionId",
          foreignField: "_id",
          as: "pollOption"
        }
      },
      { $unwind: "$pollOption" }
    ];
    if (contentId) {
      pipeline.push({ $match: { "pollOption.contentId": ObjectId(contentId) } });
    }

    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          pollOptionId: "$pollOption._id",
          option: "$pollOption.option",
          votedAt: "$createdAt"
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    const [votes] = await Model.PollVotes.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, votes);
  } catch (error) {
    next(error);
  }
};

module.exports.pollVote = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.pollVote.validateAsync(req.body);

    const pollOptionId = ObjectId(req.body.pollOptionId);
    const contentId = ObjectId(req.body.contentId);
    const userId = req.user._id;

    const option = await Model.PollOptions.findOne({ _id: pollOptionId, contentId });
    if (!option) {
      return res.error(constants.MESSAGES[lang].OPTION_NOT_FOUND);
    }
    const optionIds = await Model.PollOptions.find({ contentId }).distinct("_id");
    let existingVote = await Model.PollVotes.findOne({
      userId,
      pollOptionId: { $in: optionIds }
    });

    if (existingVote) {
      if (existingVote.pollOptionId.equals(pollOptionId)) {
        await Model.PollVotes.deleteOne({ _id: existingVote._id });
        await Model.PollOptions.updateOne(
          { _id: pollOptionId },
          { $inc: { votes: -1 } }
        );
        await Model.Content.updateOne(
          { _id: contentId },
          { $inc: { votesCount: -1 } }
        );

        return res.success(constants.MESSAGES[lang].VOTE_REMOVED);
      } else {
        await Model.PollOptions.updateOne(
          { _id: existingVote.pollOptionId },
          { $inc: { votes: -1 } }
        );

        existingVote.pollOptionId = pollOptionId;
        await existingVote.save();

        await Model.PollOptions.updateOne(
          { _id: pollOptionId },
          { $inc: { votes: 1 } }
        );
        return res.success(constants.MESSAGES[lang].VOTE_UPDATED, existingVote);
      }
    }
    let newVote = await Model.PollVotes.create({ userId, pollOptionId });

    await Model.PollOptions.updateOne(
      { _id: pollOptionId },
      { $inc: { votes: 1 } }
    );

    await Model.Content.updateOne(
      { _id: contentId },
      { $inc: { votesCount: 1 } }
    );

    return res.success(constants.MESSAGES[lang].VOTE_SUBMITTED, newVote);
  } catch (error) {
    next(error);
  }
};

module.exports.coTutorStatus = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Tutor.coTutorStatus.validateAsync(req.body);
    const classId = ObjectId(req.body.classId);
    const tutorId = req.user._id;
    const classRequest = await Model.ClassCoTutors.findOne({
      classId: classId,
      tutorId: tutorId,
      status: constants.TUTOR_STATUS.PENDING
     });
    if (!classRequest) return res.error(constants.MESSAGES[lang].CLASS_REQUEST_NOT_FOUND);
    classRequest.status = req.body.status;
    await classRequest.save();
    return res.success(constants.MESSAGES[lang].CLASS_REQUEST_UPDATED);
  } catch (error) {
    next(error);
  }
};

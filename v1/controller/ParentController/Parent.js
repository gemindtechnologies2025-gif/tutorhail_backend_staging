/* eslint-disable no-unused-vars */
const Model = require("../../../models/index");
const Validation = require("../../validations");
const Auth = require("../../../common/authenticate");
const mongoose = require("mongoose");
const constants = require("../../../common/constants");
const services = require("../../../services/index");
const ObjectId = mongoose.Types.ObjectId;
const functions = require("../../../common/functions");
const moment = require("moment");
const common = require("../../../services/common");
const cart = require("../PaymentController/pesapalPayment");
const paymentCommon = require("../PaymentController/common");
const axios = require("axios");

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
        linkedInId: req.body.linkedInI
      });
    }
    if (req.body.microsoftId) {
      socials.push({
        microsoftId: req.body.microsoftId
      });
    }
    if (!socials.length)
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
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
    if (req.body.linkedIn) {
      user.image = req.body.image;
      user.name = req.body.name;
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
    //Create a JTI for secure login using JWT.
    user.jti = functions.generateRandomCustom(25);
    user.role = constants.APP_ROLE.PARENT;
    await user.save();
    user = JSON.parse(JSON.stringify(user));
    //Issue an unique access token to ensure single login.
    user.accessToken = await Auth.getToken({
      _id: user._id,
      role: "user",
      jti: user.jti,
      sessionId: sessionId
    });
    return res.success(
      successMessage == 1
        ? constants.MESSAGES[lang].LOGIN_SUCCESS
        : constants.MESSAGES[lang].ACCOUNT_CREATED_SUCCESSFULLY,
      user
    );
  } catch (error) {
    next(error);
  }
};
async function getAccessToken(body) {
  try {
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code: body.code,
          redirect_uri: body.frontendUrl,
          client_id: "78nu6rctvt5uf7",
          client_secret: "WPL_AP0.nOiZN4xazC0GjIJp.MzYwMzEwNzIzMQ=="
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    return tokenResponse.data;
  } catch (error) {
    console.error("LinkedIn token exchange error:", error);
  }
}
async function userData(token) {
  try {
    const dataUser = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return dataUser.data;
  } catch (error) {
    console.error(error);
  }
}
module.exports.linkedInToken = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let token = await getAccessToken(req.body);
    let usersData = await userData(token.access_token);
    return res.success(constants.MESSAGES[lang].SUCCESS, usersData);
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
    req.body.role = constants.APP_ROLE.PARENT;
    req.body.secondaryRole = constants.APP_ROLE.PARENT;
    let dataToSave = req.body;
    //Create a user and check using which verification method user wants to very his/her account.
    let user = await Model.User.create(dataToSave);
    //Send verification code using Sms service or Email service.
    if (process.env.NODE_ENV !== "staging") {
      if (req.body.email) {
        let payload = {
          email: req.body.email.toLowerCase(),
          type: constants.VERIFICATION_TYPE.SIGNUP
        };
        services.EmalService.sendEmailVerificationParent(payload);
      } else if (req.body.phoneNo) {
        let payload = {
          dialCode: user.dialCode,
          phoneNo: user.phoneNo,
          type: constants.VERIFICATION_TYPE.SIGNUP
        };
        services.SmsService.sendPhoneVerification(payload);
      }
    }
    //Decode the password using Bcrypt to ensure secure login.
    if (req.body.password) {
      user.isPasswordSet = true;
      await user.setPassword(req.body.password);
    }
    await user.save();
    return res.success(
      constants.MESSAGES[lang].ACCOUNT_CREATED_SUCCESSFULLY,
      user
    );
  } catch (error) {
    next(error);
  }
};
//Login the user using phoneNo/Email.
module.exports.login = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Parent.login.validateAsync(req.body);

    let user;
    if(req.body.email) {
      user = await Model.User.findOne({
        email: req.body.email.toLowerCase(),
        role: constants.APP_ROLE.PARENT,
        isDeleted: false
      });
    if (user) {
      await user.authenticate(req.body.password);
    }
    if (!user) {
      throw new Error(constants.MESSAGES[lang].USER_NOT_FOUND);
    }
    } else if (req.body.phoneNo) {
      user = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        role: constants.APP_ROLE.PARENT,
        isDeleted: false
      });
      if (!user) {
        throw new Error(constants.MESSAGES[lang].USER_NOT_FOUND);
      }
      if (user) {
        if (user.isBlocked)
          throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
        // In staging: do not send SMS, just acknowledge
        if (process.env.NODE_ENV === "staging") {
          return res.success(constants.MESSAGES[lang].VERIFICATION_CODE_SEND);
        }
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
    if (user.isBlocked)
      throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
    
    user.secondaryRole = constants.APP_ROLE.PARENT;
    user.loginCount += 1;

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
    user.jti = functions.generateRandomCustom(25);
    await user.save();

    user = JSON.parse(JSON.stringify(user));
    user.accessToken = await Auth.getToken({
      _id: user._id,
      role: "user",
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
    await Model.User.updateOne(
      {
        _id: req.user._id,
        isDeleted: false
      },
      {
        $pull: {
          deviceDetails: { sessionId }
        }
      }
    );
    return res.success(constants.MESSAGES[lang].LOGOUT_SUCCESS);
  } catch (error) {
    // Pass any errors to the error handler
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
      parentId: req.user._id,
      role: constants.ROLE.PARENT,
      isRead: false
    });
    const chatUnreadCount = await Model.ChatMessage.countDocuments({
      parentId: req.user._id,
      sentBy: constants.APP_ROLE.TUTOR,
      isParentRead: false
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

    let existBooking = await Model.Booking.findOne({
      parentId: req.user._id,
      isDeleted: false,
      bookingStatus: {
        $nin: [
          constants.BOOKING_STATUS.COMPLETED,
          constants.BOOKING_STATUS.CANCELLED,
          constants.BOOKING_STATUS.REJECTED
        ]
      }
    });

    if (existBooking)
      throw new Error(constants.MESSAGES[lang].BOOKING_EXIST_PARENT);

    await Model.User.findOneAndUpdate({
        _id: req.user._id
      },{
        $set: {
          isDeleted: true,
          deletedAt: new Date()
        }
      },{
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
    await Validation.Parent.updateProfile.validateAsync(req.body);
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
          services.EmalService.sendEmailVerificationParent(dataToSend);
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
    if (userData == null)
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    if (userData.isEmailVerified && req.body.email == "") {
      delete req.body.email;
    }
    if (userData.isPhoneVerified  && req.body.phoneNo == "") {
      delete req.body.phoneNo;
      delete req.body.dialCode;
    }
    if (req.body.dialCode && !req.body.dialCode.includes("+")) {
      req.body.dialCode = "+" + req.body.dialCode;
    }
    req.body.isProfileComplete = true;
    let updated = await Model.User.findOneAndUpdate({
        _id: req.user._id,
        isDeleted: false
      },{
        $set: req.body
      },{
        new: true
      });

    if (updated && userData.isProfileComplete == false) {
      process.emit("sendNotification", {
        parentId: updated._id,
        receiverId: updated._id,
        values: updated,
        role: constants.ROLE.PARENT,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.REGISTER
      });
    }
    let admin = await Model.Admin.findOne({
      isDeleted: false
    });
    if (updated && !userData.isProfileComplete) {
      process.emit("sendNotification", {
        adminId: admin._id,
        receiverId: admin._id,
        values: updated,
        role: constants.ROLE.ADMIN,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.PARENT_REGISTER
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
      _id: req.user._id,
      isDeleted: false
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
      _id: req.user._id,
      isDeleted: false
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
//Send/Resend Otp to the user for verifcation
module.exports.sendOtp = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.User.sendOTP.validateAsync(req.body);
    // In staging: do not send OTP via SMS/Email; just acknowledge
    if (process.env.NODE_ENV === "staging") {
      return res.success(constants.MESSAGES[lang].OTP_SENT);
    }
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
            throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
          }
        }
        let dataToSend = {
          phoneNo: req.body.phoneNo,
          dialCode: req.body.dialCode,
          type: req.body.type,
          parentId: req.user ? req.user._id : null
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
            throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
          }
        }
        let dataToSend = {
          email: req.body.email.toLowerCase(),
          type: req.body.type,
          parentId: req.user ? req.user._id : null
        };
        services.EmalService.sendEmailVerificationParent(dataToSend);
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
    await Validation.Parent.verifyOTP.validateAsync(req.body);
    // Staging-only policy: accept ONLY OTP "1234" and reject all others
    if (process.env.NODE_ENV === "staging") {
      if (String(req.body.otp) !== "1234") {
        throw new Error(constants.MESSAGES[lang].INVALID_OTP);
      }
    }
    let data = null;
    let message;
    
    let verify;
    if (req.body.dialCode && req.body.phoneNo && req.body.otp) {
      if (process.env.NODE_ENV === "staging") {
        // Do not call Twilio in staging; only accept 1234
        verify = String(req.body.otp) === "1234";
      } else {
        let payload = {
          phoneNo: req.body.phoneNo,
          dialCode: req.body.dialCode,
          otp: req.body.otp
        };
        verify = await services.SmsService.verifyOtp(payload);
      }
    }

    let qry = {
      otp: req.body.otp
    };
    if (req.user) {
      qry.parentId = req.user._id;
    }
    if (req.body.email) {
      qry.email = req.body.email.toLowerCase();
    }

    //Check if user has sent any otp for verification.
    if (req.body.phoneNo) {
      if (!verify) {
        throw new Error(constants.MESSAGES[lang].INVALID_OTP);
      }
    }

    let verificationType;
    let updatePayload = {};
    let otp = await Model.Otp.findOne(qry);
    if (req.body.email) {
      if (process.env.NODE_ENV === "staging" && String(req.body.otp) === "1234") {
        // Bypass DB OTP check in staging and trust incoming type/email
        verificationType = Number(req.body.type);
        updatePayload.email = req.body.email.toLowerCase();
      } else {
        if (!otp) {
          throw new Error(constants.MESSAGES[lang].INVALID_OTP);
        }
        verificationType = otp.type;
        if (otp.email) {
          updatePayload.email = otp.email;
        }
      }
    }
    
    if (req.user && req.user._id) {
      if (verify) {
        updatePayload.phoneNo = req.body.phoneNo;
        updatePayload.dialCode = req.body.dialCode;
      }
      await Model.User.findOneAndUpdate({
          _id: req.user._id,
          isDeleted: false
        },{
          $set: updatePayload
        },{
          new: true
        });
    }

    if (otp) await Model.Otp.findByIdAndRemove(otp._id);
    if (req.body.email) {
      data = await Model.User.findOneAndUpdate({
          email: req.body.email.toLowerCase(),
          isDeleted: false
        },{
          $set: {
            isEmailVerified: true
          }
        },{
          new: true
        });
    } else {
      data = await Model.User.findOneAndUpdate({
          phoneNo: req.body.phoneNo,
          dialCode: req.body.dialCode,
          isDeleted: false
        },{
          $set: {
            isPhoneVerified: true
          }
        },{
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
      data.loginCount += 1;
      data.secondaryRole = constants.APP_ROLE.PARENT;
      message = constants.MESSAGES[lang].LOGIN_SUCCESS;
    }
    if (verificationType == constants.VERIFICATION_TYPE.UPDATE) {
      message = req.body.email
        ? constants.MESSAGES[lang].EMAIL_UPDATE_SUCCESSFULLY
        : constants.MESSAGES[lang].PHONE_UPDATE_SUCCESSFULLY;
    }
    if (verificationType == constants.VERIFICATION_TYPE.FORGET) {
      message = constants.MESSAGES[lang].ACCOUNT_VERIFIED;
    }

    data.jti = functions.generateRandomCustom(25);
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
    data.isBookLogin = false;
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
      role: "user",
      jti: data.jti,
      sessionId: sessionId
      //secretId: req.headers.deviceId
    });
    return res.success(message, data);
  } catch (error) {
    next(error);
  }
};

//Address
module.exports.addAddress = async (req, res, next) => {
  try {
    await Validation.Parent.addAddress.validateAsync(req.body);
    let lang = req.headers.lang || "en";
    req.body.parentId = req.user._id;

    if (req.body.longitude && req.body.latitude) {
      req.body.location = {
        type: "Point",
        coordinates: [req.body.longitude, req.body.latitude]
      };
    }
    let addAddress = await Model.ParentAddress.create(req.body);
    return res.success(constants.MESSAGES[lang].SUCCESS, addAddress);
  } catch (error) {
    next(error);
  }
};
module.exports.getAddress = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let id = req.params.id;
    if (id == null) {
      let address = await Model.ParentAddress.find({
        parentId: req.user._id,
        isDeleted: false
      })
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit)
        .populate("parentId");
      let totaluserAddress = await Model.ParentAddress.countDocuments({
        parentId: req.user._id,
        isDeleted: false
      });

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        address,
        totaluserAddress
      });
    } else {
      let address = await Model.ParentAddress.findOne({
        _id: ObjectId(req.params.id),
        isDeleted: false
      }).populate("parentId");
      if (address == null)
        throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, address);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.updateAddress = async (req, res, next) => {
  try {
    await Validation.Parent.addAddress.validateAsync(req.body);
    let lang = req.headers.lang || "en";
    const updatedAddress = await Model.ParentAddress.findOneAndUpdate(
      {
        _id: ObjectId(req.params.id),
        isDeleted: false
      },
      {
        $set: req.body
      },
      {
        new: true
      }
    );
    return res.success(constants.MESSAGES[lang].SUCCESS, updatedAddress);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteAddress = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let address = await Model.ParentAddress.findOneAndUpdate(
      {
        _id: ObjectId(req.params.id)
      },
      {
        $set: {
          isDeleted: true
        }
      },
      {
        new: true
      }
    );
    return res.success(constants.MESSAGES[lang].SUCCESS, address);
  } catch (error) {
    next(error);
  }
};

//Search
module.exports.addSearch = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    req.body.parentId = req.user._id;

    let search = await Model.SearchHistory.create(req.body);
    return res.success(constants.MESSAGES[lang].SUCCESS, search);
  } catch (error) {
    next(error);
  }
};
module.exports.getSearch = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let search = await Model.SearchHistory.find({
      isDeleted: false,
      parentId: req.user._id
    })
      .populate("tutorId", "name image email phoneNo")
      .populate("parentId", "name image email phoneNo");
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, search);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteSearch = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    let parentId = req.user._id;

    await Model.SearchHistory.deleteMany({
      parentId: parentId
    });
    return res.success(
      constants.MESSAGES[lang].SEARCH_HISTORY_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};

//Dashboard
module.exports.dashBoard = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let qry = {};
    let pipeline = [];
    let pipelineRecomd = [];

    pipeline.push({
        $match: {
          _id: { $ne: req.user?._id },
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "_id",
          foreignField: "tutorId",
          as: "teachingdetails"
        }
      },{
        $unwind: {
          path: "$teachingdetails",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "teachingdetails.subjectIds",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $lookup: {
          from: "wishlists",
          let: { tutorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$tutorId", "$$tutorId"] },
                parentId: req.user ? req.user._id : ""
              }
            }
          ],
          as: "wishlist"
        }
      },{
        $addFields: {
          fav: { $size: "$wishlist" }
        }
      },{
        $addFields: {
          isFav: {
            $cond: { if: { $eq: ["$fav", 0] }, then: false, else: true }
          }
        }
      },{
        $lookup: {
          from: "follows",
          let: { tutorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tutorId", "$$tutorId"] },
                    { $eq: ["$parentId", req.user ? req.user._id : ""] }
                  ]
                }
              }
            }
          ],
          as: "followInfo"
        }
      },{
        $addFields: {
          isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
        }
      },{
        $addFields: {
          classes: "$teachingdetails.classes",
          subjects: "$subjects.name"
        }
      },{
        $match: qry
      },{
        $project: {
          role: 1,
          name: 1,
          price: 1,
          avgRating: 1,
          image: 1,
          isFav: 1,
          subjects: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          documentVerification: 1,
          isFollowing: 1,
          followers: 1,
          views: 1,
          isActive: 1,
          bannerImg: 1,
          classes: 1,
          "teachingdetails.totalTeachingExperience": 1,
          "teachingdetails.price": 1,
          "teachingdetails.usdPrice": 1,
          "teachingdetails.achievement": 1,
          "teachingdetails.specialization": 1,
          "teachingdetails.higherEdu": 1,
          "teachingdetails.country": 1
        }
      },{
        $limit: 4
      },{
        $sort: {
          avgRating: -1
        }
    });

    pipelineRecomd.push({
        $match: {
           _id: { $ne: req.user?._id },
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "_id",
          foreignField: "tutorId",
          as: "teachingdetails"
        }
      },{
        $unwind: {
          path: "$teachingdetails",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "teachingdetails.subjectIds",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $lookup: {
          from: "wishlists",
          let: { tutorId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$tutorId", "$$tutorId"] },
                parentId: req.user ? req.user._id : ""
              }
            }],
          as: "wishlist"
        }
      },{
        $addFields: {
          fav: { $size: "$wishlist" }
        }
      },{
        $addFields: {
          isFav: {
            $cond: { if: { $eq: ["$fav", 0] }, then: false, else: true }
          },
          experience: { $toString: "$teachingdetails.totalTeachingExperience" },
          language: { $toString: "$teachingdetails.teachingLanguage" }
        }
      },{
        $addFields: {
          _search: {
            $concat: [{ $ifNull: ["$name", ""] }]
          }
        }
      },{
        $lookup: {
          from: "follows",
          let: { tutorId: "$_id" },
          pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tutorId", "$$tutorId"] },
                    { $eq: ["$parentId", req.user ? req.user._id : ""] }
                  ]
                }
              }
            }],
          as: "followInfo"
        }
      },{
        $addFields: {
          isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
        }
      },{
        $addFields: {
          price: "$teachingdetails.price",
          subjects: "$subjects.name"
        }
      },{
        $addFields: {
          classes: "$teachingdetails.classes"
        }
      },{
        $match: qry
      },{
        $project: {
          role: 1,
          name: 1,
          price: 1,
          avgRating: 1,
          image: 1,
          isFav: 1,
          bookCount: 1,
          subjects: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          documentVerification: 1,
          isFollowing: 1,
          followers: 1,
          views: 1,
          isActive: 1,
          bannerImg: 1,
          classes: 1,
          "teachingdetails.totalTeachingExperience": 1,
          "teachingdetails.price": 1,
          "teachingdetails.usdPrice": 1,
          "teachingdetails.achievement": 1,
          "teachingdetails.specialization": 1,
          "teachingdetails.higherEdu": 1,
          "teachingdetails.country": 1
        }
      },{
        $limit: 4
      },{
        $sort: {
          bookCount: -1
        }
    });

    let tutor = await Model.User.aggregate(pipeline);
    let recomended = await Model.User.aggregate(pipelineRecomd);

    let parentAddress = "";
    if (req.user && req.user._id) {
      const parent = await Model.User.findOne({
        _id: req.user._id,
        isDeleted: false
      }).select("name image address longitude latitude");

      if (parent) {
        parentAddress = parent;
      }
    }

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      tutor,
      recomended,
      parentAddress
    });
  } catch (error) {
    next(error);
  }
};
module.exports.homepage = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let pipeline = [{
        $match: {
          isDeleted: false,
          parentId: req.user._id,
          bookingStatus: constants.BOOKING_STATUS.ACCEPTED,
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $unwind: {
          path: "$tutors",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
        from: "teachingdetails",
        localField: "tutorId",
        foreignField: "tutorId",
        as: "teachingdetails"
      }
     },{
        $unwind: {
        path: "$teachingdetails",
        preserveNullAndEmptyArrays: false
      }
    },{
      $lookup: {
        from: "subjects",
        localField: "teachingdetails.subjectIds",
        foreignField: "_id",
        as: "subjects"
      }
    },{
        $lookup: {
          from: "bookingdetails",
          let: {
            bookingId: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$bookingId", "$$bookingId"]
                }
              }
            },{
              $lookup: {
                from: "otps",
                let: {
                  bookingdetailId: "$_id"
                },
                pipeline: [{
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: ["$bookingDetailId", "$$bookingdetailId"]
                          }
                        ]
                      }
                    }
                  }],
                as: "otp"
              }
            },{
              $unwind: {
                path: "$otp",
                preserveNullAndEmptyArrays: true
              }
            }],
          as: "bookingdetails"
        }
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          "tutors.name": 1,
          "tutors.image": 1,
          "tutors.bannerImg": 1,
          "tutors.documentVerification": 1,
          "teachingdetails.price": 1,
          "teachingdetails.classes": 1,
          "bookingdetails.date": 1,
          "bookingdetails.startTime": 1,
          "bookingdetails.endTime": 1,
          "bookingdetails.otp": 1,
          "bookingdetails.bookingStatus": 1,
          "bookingdetails.pairingType": 1,
          "subjects.name": 1,
          "teachingdetails.country": 1
        }
      },{
        $limit: 1
      }];
    let [booking] = await Model.Booking.aggregate(pipeline);

    let tutorPipeline = [{
        $match: {
           _id: { $ne: req.user?._id },
          isDeleted: false,
          isBlocked: false,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $lookup: {
        from: "teachingdetails",
        localField: "tutorId",
        foreignField: "tutorId",
        as: "teachingdetails"
      }
     },{
        $unwind: {
        path: "$teachingdetails",
        preserveNullAndEmptyArrays: false
      }
    },{
      $lookup: {
        from: "subjects",
        localField: "teachingdetails.subjectIds",
        foreignField: "_id",
        as: "subjects"
      }
    },{
        $lookup: {
          from: "wishlists",
          let: {
            tutorId: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$tutorId", "$$tutorId"]
                },
                parentId: req.user ? req.user._id : ""
              }
            }
          ],
          as: "wishlist"
        }
      },{
        $addFields: {
          fav: {
            $size: "$wishlist"
          }
        }
      },{
        $addFields: {
          isFav: {
            $cond: {
              if: {
                $eq: ["$fav", 0]
              },
              then: false,
              else: true
            }
          }
        }
      },{
        $addFields: {
          price: "$teachingdetails.price",
          subjects: "$subjects.name"
        }
      },{
        $project: {
          name: 1,
          price: 1,
          avgRating: 1,
          image: 1,
          isFav: 1,
          subjects: 1,
          documentVerification: 1,
          isActive: 1,
          "teachingdetails.country": 1
        }
      }];

    tutorPipeline = await common.pagination(tutorPipeline, skip, limit);
    let [tutor] = await Model.User.aggregate(tutorPipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      booking,
      tutor: tutor.data,
      totalTutor: tutor.total
    });
  } catch (error) {
    next(error);
  }
};

//Tutor
module.exports.getTutor = async (req, res, next) => {
  try {
    await Validation.Parent.filterTutor.validateAsync(req.body);
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let qry = {};
    let pipeline = [];

    if (req.body.search) {
      const searchRegex = new RegExp(req.body.search.trim(), "i");
      qry.$or = [{
          userName: searchRegex
        },{
          name: searchRegex
        },{
          subjects: searchRegex
        }];
      }

    if (req.body.teachingStyle) {
      qry["teachingdetails.teachingStyle"] = { $in: req.body.teachingStyle };
    }
    if (req.body.documentVerification) {
      qry.documentVerification = Boolean(req.body.documentVerification);
    } else if (req.body.documentVerification == false) {
      qry.documentVerification = Boolean(req.body.documentVerification);
    }
    if (req.body.teachingLanguage) {
      qry["teachingdetails.teachingLanguage"] = Number(req.body.teachingLanguage);
    }
    if (req.body.curriculum) {
      qry["teachingdetails.curriculum"] = { $in: req.body.curriculum };
    }
    if (req.body.classes && req.body.classes.length > 0) {
       qry["teachingdetails.classes"] = { $in: req.body.classes };
    }
    if (req.body.subjects && req.body.subjects.length > 0) {
      qry["teachingdetails.subjectIds"] = {
      $in: req.body.subjects.map((s) => ObjectId(s._id))
      };
    }
    if (req.body.gender) {
      qry.gender = String(req.body.gender);
    }
    if (req.body.totalTeachingExperience) {
      qry["teachingdetails.totalTeachingExperience"] = Number(req.body.totalTeachingExperience);
    }
    if (req.body.startPrice && req.body.endPrice) {
      qry["teachingdetails.price"] = {
        $gte: Number(req.body.startPrice),
        $lte: Number(req.body.endPrice)
      };
    } else if (req.body.startPrice) {
      qry["teachingdetails.price"] = {
        $gte: Number(req.body.startPrice)
      };
    } else if (req.body.endPrice) {
      qry["teachingdetails.price"] = {
        $lte: Number(req.body.endPrice)
      };
    }
    if (req.body.longitude && req.body.latitude) {
      pipeline.push({
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                Number(req.body.longitude),
                Number(req.body.latitude)
              ]
            },
            distanceField: "dist.calculated",
            maxDistance: parseFloat(100000) * parseInt(10),
            query: {},
            spherical: true
          }
        },{
          $sort: {
            distanceField: 1
          }
        });
      }

    pipeline.push({
        $match: {
           _id: { $ne: req.user?._id },
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $lookup: {
        from: "teachingdetails",
        localField: "_id",
        foreignField: "tutorId",
        as: "teachingdetails"
      }
     },{
        $unwind: {
        path: "$teachingdetails",
        preserveNullAndEmptyArrays: true
      }
     },{
      $lookup: {
        from: "subjects",
        localField: "teachingdetails.subjectIds",
        foreignField: "_id",
        as: "subjects"
      }
    },{
        $lookup: {
          from: "wishlists",
          let: {
            tutorId: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$tutorId", "$$tutorId"]
                },
                parentId: req.user ? req.user._id : ""
              }
            }],
          as: "wishlist"
        }
      },{
        $addFields: {
          fav: {
            $size: "$wishlist"
          }
        }
      },{
        $addFields: {
          isFav: {
            $cond: {
              if: {
                $eq: ["$fav", 0]
              },
              then: false,
              else: true
            }
          }
        }
      },{
          $lookup: {
            from: "follows",
            let: { tutorId: "$_id" },
            pipeline: [{
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$tutorId", "$$tutorId"] },
                      { $eq: ["$parentId", req.user ? req.user._id : ""] }
                    ]
                  }
                }
              }],
            as: "followInfo"
          }
        },{
          $addFields: {
            isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
          }
        },{
        $addFields: {
          classes: "$teachingdetails.classes",
          subjects: "$subjects.name"
        }
      },{
        $match: qry
      },{
        $project: {
          name: 1,
          avgRating: 1,
          image: 1,
          isFav: 1,
          documentVerification: 1,
          latitude: 1,
          longitude: 1,
          classes: 1,
          subjects: 1,
          isFollowing: 1,
          followers: 1,
          views: 1,
          bookCount: 1,
          isActive: 1,
          bannerImg: 1,
          "teachingdetails.startTime": 1,
          "teachingdetails.endTime": 1,
          "teachingdetails.totalTeachingExperience": 1,
          "teachingdetails.price": 1,
          "teachingdetails.usdPrice": 1,
          "teachingdetails.achievement": 1,
          "teachingdetails.specialization": 1,
          "teachingdetails.higherEdu": 1,
          "teachingdetails.country": 1
        }
      });
    if (req.body.startTime && req.body.endTime) {
      const requestedStartTime = moment.utc(req.body.startTime).format("HH:mm");
      const requestedEndTime = moment.utc(req.body.endTime).format("HH:mm");
      pipeline.push({
        $addFields: {
          startTimeOnly: {
            $dateToString: { format: "%H:%M", date: "$teachingdetails.startTime" }
          },
          endTimeOnly: {
            $dateToString: { format: "%H:%M", date: "$teachingdetails.endTime" }
          }
        }
      });
      pipeline.push({
        $match: {
          $expr: {
            $and: [
              { $lte: ["$startTimeOnly", requestedEndTime] },
              { $gte: ["$endTimeOnly", requestedStartTime] }
            ]
          }
        }
      });
      }
    
    if (req.query.type == constants.LIST_TYPE.POPULAR) {
      pipeline.push({
        $sort: {
          avgRating: -1
        }
      });
    } else if (req.query.type == constants.LIST_TYPE_RECOMMENDED) {
      pipeline.push({
        $sort: {
          bookCount: -1
        }
      });
    }

    if(req.body.avgRating) {
      pipeline.push({
          $addFields: {
            rate: {
              $ceil: "$avgRating"
            }
          }
        },{
          $addFields: {
            rates: {
              $toInt: "$rate"
            }
          }
        },{
          $match: {
            rates: req.body.avgRating
          }
        });
      }

    if (req.body.sortBy) {
      if (req.body.sortBy == "descending") {
        pipeline.push({
          $sort: {
            "teachingdetails.price": -1
          }
        });
      } else if (req.body.sortBy == "ascending") {
        pipeline.push({
          $sort: {
            "teachingdetails.price": 1
          }
        });
      }
    }

    pipeline = await common.pagination(pipeline, skip, limit);
    let [tutor] = await Model.User.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);
  } catch (error) {
    console.log("error", error);
  }
};
module.exports.tutor = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    if(req.user && req.user._id){
      if (req.params.id && req.query.isTutorSearch == "true") {
      let data = {
        parentId: req.user._id,
        tutorId: ObjectId(req.params.id)
      };
      await Model.SearchHistory.create(data);
    }
  }
    let pipeline = [{
        $match: {
          _id: ObjectId(req.params.id),
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $lookup: {
        from: "teachingdetails",
        localField: "_id",
        foreignField: "tutorId",
        as: "teachingdetails"
      }
     },{
        $unwind: {
        path: "$teachingdetails",
        preserveNullAndEmptyArrays: true
      }
    },{
      $lookup: {
        from: "subjects",
        localField: "teachingdetails.subjectIds",
        foreignField: "_id",
        as: "subjects"
      }
    },{
        $lookup: {
          from: "wishlists",
          let: {
            tutorId: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$tutorId", "$$tutorId"]
                },
                parentId: req.user && req.user._id ? req.user._id : ""
              }
          }],
          as: "wishlist"
        }
      },{
        $addFields: {
          fav: {
            $size: "$wishlist"
          }
        }
      },{
        $addFields: {
          isFav: {
            $cond: {
              if: {
                $eq: ["$fav", 0]
              },
              then: false,
              else: true
            }
          }
        }
      },{
          $lookup: {
            from: "follows",
            let: { tutorId: "$_id" },
            pipeline: [{
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$tutorId", "$$tutorId"] },
                      { $eq: ["$parentId", req.user ? req.user._id : ""] }
                    ]
                  }
                }
              }],
            as: "followInfo"
          }
        },{
          $addFields: {
            isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
          }
        },{
        $lookup: {
          from: "requireddocuments",
          let: {
            tutorId: "$_id"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$tutorId", "$$tutorId"]
                },
                isDeleted: false
              }
            }],
          as: "documents"
        }
      },{
        $addFields: {
          certificates: {
            $filter: {
              input: "$documents",
              cond: {
                $eq: [
                  "$$this.documentType",
                  constants.DOCUMENT_TYPE.CERTIFICATES
                ]
              }
            }
          },
          achievements: {
            $filter: {
              input: "$documents",
              cond: {
                $eq: [
                  "$$this.documentType",
                  constants.DOCUMENT_TYPE.ACHIEVEMENTS
                ]
              }
            }
          }
        }
      },{
        $project: {
          name: 1,
          userName: 1,
          avgRating: 1,
          shortBio: 1,
          gender: 1,
          image: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          isActive: 1,
          isFav: 1,
          bookCount: 1,
          documentVerification: 1,
          isFollowing: 1,
          followers: 1,
          views: 1,
          bannerImg: 1,
          "teachingdetails.educationLevel": 1,
          "teachingdetails.teachingLanguage": 1,
          "teachingdetails.totalTeachingExperience": 1,
          "teachingdetails.startTime": 1,
          "teachingdetails.endTime": 1,
          "teachingdetails.price": 1,
          "teachingdetails.usdPrice": 1,
          "teachingdetails.classes": 1,
          "subjects.name": 1,
          "subjects._id": 1,
          "ratings.review": 1,
          "ratings.rating": 1,
          "ratings.parents": 1,
          "certificates._id": 1,
          "certificates.eduDocs": 1,
          "certificates.description": 1,
          "certificates.startDate": 1,
          "certificates.endDate": 1,
          "certificates.institutionName": 1,
          "certificates.fieldOfStudy": 1,
          "achievements._id": 1,
          "achievements.eduDocs": 1,
          "achievements.description": 1,
          "achievements.startDate": 1,
          "achievements.endDate": 1,
          "achievements.institutionName": 1,
          "teachingdetails.achievement": 1,
          "teachingdetails.specialization": 1,
          "teachingdetails.higherEdu": 1,
          "teachingdetails.country": 1
        }
      }];
    let tutor = await Model.User.aggregate(pipeline);

if (req.user) {
  const tutorId = ObjectId(req.params.id);
  const parentId = req.user._id;

  const alreadyViewed = await Model.TutorViews.findOne({
    tutorId,
    parentId
  });

  if (!alreadyViewed) {
    await Model.TutorViews.create({
      tutorId,
      parentId
    });

    await Model.User.updateOne(
      { _id: tutorId },
      { $inc: { views: 1 } }
    );
  }
}
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);
  } catch (error) {
    next(error);
  }
};
module.exports.reportTutor = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.reportContent.validateAsync(req.body);
    req.body.parentId = req.user._id;
    req.body.status = constants.INQUIRY_STATUS.PENDING;
    const report = await Model.ReportTutor.create(req.body);
    return res.success(constants.MESSAGES[lang].REPORT_CREATED, report);
  } catch (error) {
    next(error);
  }
};

//Wishlist
module.exports.addWishlist = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Parent.addWishlist.validateAsync(req.body);
    if (req.body.tutorId) {
      let exists = await Model.Wishlist.findOne({
        parentId: req.user._id,
        tutorId: ObjectId(req.body.tutorId)
      });
      if (exists) {
        await Model.Wishlist.findOneAndRemove({
          _id: exists._id
        });
        return res.success(constants.MESSAGES[lang].REMOVED_FROM_WISHLIST, {});
      }
      req.body.parentId = req.user._id;
      let wishlist = await Model.Wishlist.create(req.body);
      return res.success(constants.MESSAGES[lang].ADDED_TO_WISHLIST, wishlist);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.getWishlist = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [{
        $match: {
          parentId: req.user._id
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $unwind: {
          path: "$tutors",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
        from: "teachingdetails",
        localField: "tutorId",
        foreignField: "tutorId",
        as: "teachingdetails"
      }
     },{
        $unwind: {
        path: "$teachingdetails",
        preserveNullAndEmptyArrays: true
      }
    },{
      $lookup: {
        from: "subjects",
        localField: "teachingdetails.subjectIds",
        foreignField: "_id",
        as: "subjects"
      }
    },{
        $addFields: {
          isFav: true
        }
      },{
        $project: {
          tutorId: 1,
          "tutors.name": 1,
          "tutors.price": 1,
          "tutors.image": 1,
          "tutors.isActive": 1,
          "tutors.followers": 1,
          "tutors.bookCount": 1,
          "tutors.avgRating": 1,
          "tutors.documentVerification": 1,
          "teachingdetails.price": 1,
          "teachingdetails.usdPrice": 1,
          "teachingdetails.totalTeachingExperience": 1,
          "teachingdetails.specialization": 1,
          "teachingdetails.achievement": 1,
          "teachingdetails.higherEdu": 1,
          "teachingdetails.classes": 1,
          "teachingdetails.country": 1,
          "subjects._id": 1,
          "subjects.name": 1,
          isFav: 1
        }
      }
    ];
    pipeline = await common.pagination(pipeline, skip, limit);
    let [wishlist] = await Model.Wishlist.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].WISHLIST_FETCHED, wishlist);
  } catch (error) {
    next(error);
  }
};

//Booking
module.exports.addBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Parent.addBooking.validateAsync(req.body);
    req.body.parentId = req.user._id;
    let totalNoOfMinutes = 0;
    let totalPrice = 0;
    let totalTransportationFees = 0;
    let transportationFees = 0;
    let totalDistance = 0;
    let discountAmount = 0;

    let active = await Model.User.findOne({
      _id: ObjectId(req.body.tutorId),
      tutorStatus: constants.TUTOR_STATUS.ACCEPTED,
      isActive: true,
      isDeleted: false
    });
    if (!active) {
      throw new Error(constants.MESSAGES[lang].TUTOR_IS_NOT_ACTIVE);
    }

    let details = await Model.TeachingDetails.findOne({
      tutorId: ObjectId(req.body.tutorId),
      isDeleted: false
    });
    
    let payment = details.price;
    if (details.country && details.country !== "USD") {
      payment = await functions.convertCurrency(payment, details.country);
    }

    let calDist = req.body.distance;
    const countryISOCode = req.user?.countryISOCode || 'US';
    let setting = await Model.AppSetting.findOne({
      countryCode: countryISOCode,
      isDeleted: false
    }).select("serviceFees serviceType distanceAmount distanceType");

    let distancePrice = setting.distanceAmount;
    let distanceType = setting.distanceType;
    let serviceType = setting.serviceType;
    let servicePrice = setting.serviceFees;

    let bookingDistance = calDist / 1000;

    if (distancePrice > 0) {
      if (distanceType === constants.DISTANCE_TYPE.KILOMETER) {
        transportationFees = bookingDistance * distancePrice;
      } else if (distanceType === constants.DISTANCE_TYPE.METER) {
        transportationFees = calDist * distancePrice;
      }
    }

    for (const timeslot of req.body.timeSlots) {
      const existingBooking = await Model.BookingDetails.findOne({
        tutorId: ObjectId(timeslot.tutorId),
        $or: [
          { startTime: { $gt: timeslot.startTime, $lt: timeslot.endTime } },
          { endTime: { $gt: timeslot.startTime, $lt: timeslot.endTime } },
          {
            $and: [
              { startTime: timeslot.startTime },
              { endTime: timeslot.endTime }
            ]
          }
        ],
        bookingStatus: {
          $nin: [constants.BOOKING_STATUS.CANCELLED, constants.BOOKING_STATUS.REJECTED]
        }
      });

      if (existingBooking) {
        throw new Error(constants.MESSAGES[lang].TIMESLOT_ALREADY_BOOKED);
      }

      let duration = moment(timeslot.endTime).diff(timeslot.startTime, "m");
      timeslot.noOfHours = duration / 60;
      totalNoOfMinutes += duration;

      // ✅ use USD price here
      timeslot.perHourPrice = timeslot.noOfHours * payment;
      totalPrice += timeslot.perHourPrice;
    }

    let totalNoOfHours = totalNoOfMinutes / 60;
    let totalBookingDetail = req.body.timeSlots.length;
    totalDistance = bookingDistance * totalBookingDetail;
    if (req.body.classModeOnline) {
      totalTransportationFees = 0;
    } else {
      totalTransportationFees = transportationFees * totalBookingDetail;
    }

    let promo;
    if (req.body.promocodeId) {
      promo = await Model.PromoCode.findOne({
        _id: ObjectId(req.body.promocodeId),
        status: true,
        isDeleted: false,
        expiryDate: { $gte: new Date() }
      }).select("discountType discount maxUser userCount");
      if (!promo) throw new Error(constants.MESSAGES[lang].PROMO_CODE_INVALID);
      if (promo.maxUser == promo.usedCount) throw new Error(constants.MESSAGES[lang].PROMO_CODE_INVALID);

      if (promo.discountType == constants.SERVICE_TYPE.FLAT) {
        discountAmount = promo.discount;
      } else if (promo.discountType == constants.SERVICE_TYPE.PERCENT) {
        discountAmount = (promo.discount * totalPrice) / 100;
      }
      if (discountAmount > totalPrice) {
        discountAmount = totalPrice;
      }
      req.body.promocodeId = promo._id;
      req.body.discountType = promo.discountType;
    }

    let grandTotal = totalPrice + totalTransportationFees - discountAmount;

    let serviceAmount = 0;
    if (servicePrice > 0) {
      if (serviceType === constants.SERVICE_TYPE.FLAT) {
        serviceAmount = servicePrice;
      } else if (serviceType === constants.SERVICE_TYPE.PERCENT) {
        serviceAmount = (servicePrice * grandTotal) / 100;
      }
    }
    let tutorMoney = grandTotal - serviceAmount;
    let bookingNumber = functions.generateBookingId();

    req.body.distance = bookingDistance;
    req.body.transportationFees = transportationFees;
    req.body.bookingNumber = bookingNumber;
    req.body.totalNoOfHours = totalNoOfHours;
    req.body.totalPrice = totalPrice;
    req.body.totalDistance = totalDistance;
    req.body.totalTransportationFees = totalTransportationFees;
    req.body.discountAmount = discountAmount;
    req.body.grandTotal = grandTotal;
    req.body.serviceFees = serviceAmount;
    req.body.tutorMoney = tutorMoney;
    req.body.serviceCharges = servicePrice;
    req.body.serviceType = serviceType;
    req.body.bookType = constants.BOOK_TYPE.NORMAL;

    let booking;
    let link;
    if (req.query.isCartScreen === "true") {
      booking = req.body;
    } else {
      let cartId = functions.generateRandomCustom(10);
      let cartData = {
        cartId: cartId,
        parentId: req.user._id,
        body: req.body
      };
      await Model.Cart.deleteMany({ parentId: req.user._id });
      await Model.Cart.create(cartData);
      link = await cart.generatePaymentLink(cartData, req.user);
      await Model.Cart.findOneAndUpdate(
        { parentId: req.user._id },
        { $set: { order_tracking_id: link.order_tracking_id } },
        { new: true }
      );
    }

    const data = {
      booking,
      link,
      setting
    };

    if (req.body.promocodeId) {
      data.promo = promo;
    }
    return res.success(constants.MESSAGES[lang].BOOKING_ADDED, data);

  } catch (error) {
    next(error);
  }
};
module.exports.getBookingSlots = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let id = req.params.id;
    let qry = {};
    if (req.query.date) {
      qry.date = new Date(req.query.date);
    }

    let pipeline = [{
        $match: {
          tutorId: ObjectId(id),
          startTime: {
            $gte: new Date()
          }
        }
      },{
        $lookup: {
          from: "bookings",
          let: {
            bookingId: "$bookingId"
          },
          pipeline: [{
              $match: {
                $expr: {
                  $eq: ["$_id", "$$bookingId"]
                },
                bookingStatus: {
                  $nin: [
                    constants.BOOKING_STATUS.CANCELLED,
                    constants.BOOKING_STATUS.REJECTED
                  ]
                }
              }
            }
          ],
          as: "bookings"
        }
      },{
        $unwind: {
          path: "$bookings",
          preserveNullAndEmptyArrays: false
        }
      },{
        $match: {
          bookingStatus: {
            $nin: [
              constants.BOOKING_STATUS.CANCELLED,
              constants.BOOKING_STATUS.REJECTED
            ]
          }
        }
      },{
        $match: qry
      },{
        $group: {
          _id: "$date",
          bookings: {
            $push: {
              startTime: "$startTime",
              endTime: "$endTime",
              customTime: "$customTime"
            }
          }
        }
      },{
        $addFields: {
          date: "$_id"
        }
      },{
        $project: {
          _id: 0
        }
      }];
    let timeSlots = await Model.BookingDetails.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, timeSlots);
  } catch (error) {
    next(error);
  }
};
module.exports.getBooking = async (req, res, next) => {
  try {
    let id = req.params.id;
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let qry = {};
    if (id == null) {
      if (req.query.bookingType == constants.BOOKING_TYPE.UPCOMING) {
        qry.bookingStatus = {
          $in: [
            constants.BOOKING_STATUS.PENDING,
            constants.BOOKING_STATUS.ACCEPTED
          ]
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
      } else if (req.query.bookingType == constants.BOOKING_TYPE.ACCEPTED) {
        qry.bookingStatus = {
          $in: [constants.BOOKING_STATUS.ACCEPTED]
        };
      }
      if (req.query.bookingStatus == constants.BOOKING_STATUS.ACCEPTED) {
        qry.bookingStatus = {
          $in: [
            constants.BOOKING_STATUS.ACCEPTED,
            constants.BOOKING_STATUS.ONGOING
          ]
        };
      }
      if (req.query.classModeOnline == 'true') {
        qry.classModeOnline = true;
      } else if (req.query.classModeOnline == 'false') {
        qry.classModeOnline = false;
      }

      let pipeline = [{
          $match: {
            parentId: ObjectId(req.user._id),
            bookType: constants.BOOK_TYPE.NORMAL                  
          }
        },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $unwind: {
          path: "$tutors",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "tutorId",
          foreignField: "tutorId",
          as: "teachingdetails"
        }
      },{
        $unwind: {
          path: "$teachingdetails",
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
            from: "bookingdetails",
            let: {
              bookingId: "$_id"
            },
            pipeline: [{
                $match: {
                  $expr: {
                    $eq: ["$bookingId", "$$bookingId"]
                  }
                }
              },{
                $lookup: {
                  from: "otps",
                  let: {
                    bookingdetailId: "$_id"
                  },
                  pipeline: [{
                      $match: {
                        $expr: {
                          $and: [
                            {
                              $eq: ["$bookingDetailId", "$$bookingdetailId"]
                            }
                          ]
                        }
                      }
                    }
                  ],
                  as: "otp"
                }
              },{
                $unwind: {
                  path: "$otp",
                  preserveNullAndEmptyArrays: true
                }
              }],
            as: "bookingdetails"
          }
        },{
          $match: qry
        },{
          $sort: {
            createdAt: -1
          }
        },{
          $project: {
            "tutors.name": 1,
            "tutors.image": 1,
            "tutors.avgRating": 1,
            "tutors.bookCount": 1,
            "tutors.documentVerification": 1,
            "tutors.isActive": 1,
            "teachingdetails.price": 1,
            "bookingdetails._id": 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails.otp": 1,
            "bookingdetails.bookingStatus": 1,
            "bookingdetails.pairingType": 1,
            "subjects.name": 1,
            classId: 1,
            additionalInfo: 1,
            bookingStatus: 1,
            isRated: 1,
            cancelReason: 1,
            cancelledAt: 1,
            learnToday: 1,
            classModeOnline: 1,
            dyteMeeting: 1,
            tutorMoney: 1,
            serviceType: 1,
            serviceCharges: 1,
            totalTransportationFees: 1,
            grandTotal: 1
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
            _id: ObjectId(id)
          }
        },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $unwind: {
          path: "$tutors",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "tutorId",
          foreignField: "tutorId",
          as: "teachingdetails"
        }
      },{
        $unwind: {
          path: "$teachingdetails",
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
          as: "parentAddress"
        }
      },{
        $unwind: {
          path: "$parentAddress",  
          preserveNullAndEmptyArrays: true
        }
        },{
          $match: qry
        },{
          $project: {
            "tutors._id": 1,
            "tutors.name": 1,
            "tutors.image": 1,
            "tutors.address": 1,
            "tutors.longitude": 1,
            "tutors.latitude": 1,
            "tutors.documentVerification": 1,
            "tutors.avgRating": 1,
            "tutors.isActive": 1,
            "teachingdetails.price": 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails._id": 1,
            "bookingdetails.otp": 1,
            "bookingdetails.bookingStatus": 1,
            "bookingdetails.pairingType": 1,
            "bookingdetails.distance": 1,
            "bookingdetails.callJoinedByTutor": 1,
            "bookingdetails.callJoinedByParent": 1,
            "subjects.name": 1,
            classId: 1,
            additionalInfo: 1,
            totalDistance: 1,
            totalNoOfHours: 1,
            totalPrice: 1,
            bookingStatus: 1,
            parentAddress: 1,
            isRated: 1,
            dyteMeeting: 1,
            cancelReason: 1,
            cancelledAt: 1,
            refundStatus: 1,
            refundRejectReason: 1,
            refundDate: 1,
            totalTransportationFees: 1,
            serviceFees: 1,
            grandTotal: 1,
            learnToday: 1,
            classModeOnline: 1,
            tutorMoney: 1,
            serviceType: 1,
            serviceCharges: 1
          }
        }];

      let [booking] = await Model.Booking.aggregate(pipeline);
      let connectionId = await common.findUniqueConnectId(
        booking.tutors._id.toString(),
        req.user._id.toString()
      );
      booking.connectionId = connectionId.toString();
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.cancelBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let bookingExist = await Model.Booking.findOne({
      _id: ObjectId(req.params.id)
    });
    let bookingTime = await Model.BookingDetails.find({
      bookingId: ObjectId(req.params.id)
    });

    if (!bookingExist) {
      throw new Error(constants.MESSAGES[lang].BOOKING_NOT_EXIST);
    }
    if (bookingExist.bookingStatus == constants.BOOKING_STATUS.REJECTED) {
      throw new Error(constants.MESSAGES[lang].BOOKING_ALREADY_CANCELLED);
    }

    const startTime = new Date(bookingTime[0].startTime).getTime();
    let isWithin45Minutes =
      startTime - Date.now() <= 45 * 60 * 1000 && startTime - Date.now() > 0;

    let updateFields = {
      bookingStatus: constants.BOOKING_STATUS.CANCELLED,
      cancelReason: req.body.cancelReason,
      refundType: isWithin45Minutes
        ? constants.REFUND_TYPE.AUTOMATIC
        : constants.REFUND_TYPE.PARENT,
      refundRequest: true,
      cancelledAt: new Date()
    };

    for (const booking of bookingTime) {
      if (
        !isWithin45Minutes &&
        booking.pairingType !== constants.PAIRING_TYPE.PENDING
      ) {
        let findDetails = await Model.BookingDetails.find({
          bookingId: ObjectId(req.params.id),
          isDeleted: false,
          pairingType: constants.PAIRING_TYPE.PENDING
        });
        let refundAmt = findDetails.reduce(
          (total, detail) => total + Math.round(detail.price),
          0
        );
        updateFields.refundType =
          constants.REFUND_TYPE.PARTIAL_CLASS_REFUND_AMOUNT;
        updateFields.refundAmount = refundAmt;
      }
    }

    if (updateFields.refundType == constants.REFUND_TYPE.AUTOMATIC) {
      updateFields.refundAmount = bookingExist.totalPrice;
    }
    if (updateFields.refundType == constants.REFUND_TYPE.PARENT) {
      updateFields.refundAmount =
        bookingExist.grandTotal - bookingExist.serviceFees;
    }

    let booking = await Model.Booking.findOneAndUpdate({
        _id: ObjectId(req.params.id)
      },{
        $set: updateFields
      },{
        new: true
      });

    await Model.BookingDetails.updateMany({
        bookingId: booking._id,
        bookingStatus: constants.BOOKING_STATUS.PENDING
      },{
        $set: {
          bookingStatus: constants.BOOKING_STATUS.CANCELLED
        },
        new: true
      });

    process.emit("sendNotification", {
      tutorId: booking.tutorId,
      receiverId: booking.tutorId,
      values: {
        bookingId: booking._id
      },
      role: constants.ROLE.TUTOR,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.BOOKING_CANCELLED
    });

    return res.success(
      constants.MESSAGES[lang].BOOKING_CANCEL_SUCCESSFULLY,
      booking
    );
  } catch (error) {
    next(error);
  }
};
module.exports.bookingDetail = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let doc = await Model.BookingDetails.findOne({
      _id: ObjectId(req.params.id)
    }).select({ bookingStatus: 1 });
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, doc);
  } catch (error) {
    next(error);
  }
};

//Setting
module.exports.setting = async (req, res, next) => {
  let lang = req.headers.lang || "en";

  const countryISOCode = req.user?.countryISOCode || 'US';

  try {
    const setting = await Model.AppSetting.findOne({
      countryCode: countryISOCode,
      isDeleted: false
    });
    if(!setting) {
      throw new Error(constants.MESSAGES[lang].SERVICE_DATA_NOT_FOUND);
    }
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, setting);
  } catch (error) {
    next(error);
  }
};

//Study Material
module.exports.studyMaterial = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let id = req.params.id;

    if (id == null) {
      let pipeline = [{
          $match: {
            parentId: req.user._id,
            isDeleted: false
          }
        },{
          $sort: {
            createdAt: -1
          }
        }];
      pipeline = await common.pagination(pipeline, skip, limit);
      let [content] = await Model.ContentMaterial.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        material: content.data,
        totalContent: content.total
      });
    } else {
      let address = await Model.ContentMaterial.findOne({
        _id: ObjectId(req.params.id),
        isDeleted: false
      });
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, address);
    }
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
    let pipeline1 = [];
    let pipeline2 = [];

    const unreadCount = await Model.Notification.countDocuments({
      parentId: req.user._id,
      isDeleted: false,
      isRead: false
    });

    pipeline1.push({
        $match: {
          parentId: req.user._id,
          isDeleted: false,
          isRead: false,
          role: constants.ROLE.PARENT,
          pushType: {
            $ne: constants.PUSH_TYPE_KEYS.DEFAULT
          }
        }
      },{
        $sort: {
          createdAt: -1
        }
      });

    pipeline1 = await common.pagination(pipeline1, skip, limit);
    let [newNotification] = await Model.Notification.aggregate(pipeline1);

    pipeline2.push({
        $match: {
          parentId: req.user._id,
          isDeleted: false,
          isRead: true,
          role: constants.ROLE.PARENT,
          pushType: {
            $ne: constants.PUSH_TYPE_KEYS.DEFAULT
          }
        }
      },{
        $sort: {
          createdAt: -1
        }
      });

    pipeline2 = await common.pagination(pipeline2, skip, limit);
    let [oldNotification] = await Model.Notification.aggregate(pipeline2);

     await Model.Notification.updateMany(
      { parentId: req.user._id, isDeleted: false },
        { isRead: true }
      );
        
      process.emit("readNotificationCount", {
        userId: String(req.user._id),
        justReadCount: unreadCount
      });

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      newNotification: newNotification.data,
      totalNewNotification: newNotification.total,
      oldNotification: oldNotification.data,
      totalOldNotification: oldNotification.total
    });
  } catch (error) {
    next(error);
  }
};

//Rating
module.exports.addRating = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Parent.addRating.validateAsync(req.body);
    
    let rating;
    
    if(req.body.type == constants.RATE_WAY.ONE_TO_ONE){
      let checkBooking = await Model.Booking.findOne({
      _id: req.body.bookingId,
      bookingStatus: constants.BOOKING_STATUS.COMPLETED
    });
    if (!checkBooking) {
      throw new Error(constants.MESSAGES[lang].BOOKING_NOT_EXIST);
    }
    await Model.Booking.findByIdAndUpdate(req.body.bookingId,{
        $set: {
          isRated: true
        }
      });
    req.body.parentId = req.user._id;
    rating = await Model.Rating.create(req.body);
     const ratings = await Model.Rating.aggregate([
        { $match: { 
          tutorId: ObjectId(req.body.tutorId)
         } },
        {
          $group: {
            _id: "$tutorId",
            avgRating: { $avg: "$rating" }
          }
        }
      ]);
       
      const avgRating = ratings[0]?.avgRating || 0;
      await Model.User.findByIdAndUpdate(req.body.tutorId,
        { $set: { avgRating: avgRating } }
      );
    }else if (req.body.type == constants.RATE_WAY.CLASS) {
      let checkBooking = await Model.Booking.findById(req.body.bookingId);
      if (!checkBooking) throw new Error(constants.MESSAGES[lang].BOOKING_NOT_EXIST);
      req.body.parentId = req.user._id;

      await Model.Rating.findOneAndUpdate({
        classId: ObjectId(req.body.classId),
        bookingId: ObjectId(req.body.bookingId),
        parentId: ObjectId(req.user._id)
      },{
        $set: {
          rating: req.body.rating
        }
      },{
        new: true,
        upsert: true 
      });
      const ratings = await Model.Rating.aggregate([
        {
          $match: {
            classId: ObjectId(req.body.classId)
          }
        },{
          $group: {
            _id: "$classId",
            avgRating: { $avg: "$rating" }
          }
        }
      ]);

      const avgRating = ratings[0]?.avgRating || 0;

      await Model.Classes.findByIdAndUpdate(req.body.classId, {
        $set: { avgRating: avgRating }
      });
      }  

    return res.success(
      constants.MESSAGES[lang].RATING_ADDED,
      rating
    );
  } catch (error) {
    next(error);
  }
};

//Customer Support
module.exports.support = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const data = await Model.CustomerSupport.create({
      parentId: req.user._id,
      customerType: constants.CUSTOMER_TYPE.PARENT,
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

//Video Call
module.exports.joinVideoCall = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.callToken.validateAsync(req.body);
    let check = await Model.BookingDetails.findOne({
      _id: ObjectId(req.body.bookingDetailId)
    });
    if (check.callJoinedByTutor == false) {
      throw new Error(constants.MESSAGES[lang].ERROR_BOOKING_NOT_STARTED_YET);
    }
    await Model.BookingDetails.findOneAndUpdate({
        _id: ObjectId(req.body.bookingDetailId)
      },{
        $set: {
          callJoinedByParent: true
        }
      },{
        new: true
      });
    return res.success(constants.MESSAGES[lang].DATA_FETCHED);
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
module.exports.getClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;
    let qry = {};

    if (req.query.canBePrivate) {
      qry.canBePrivate = true;
    }
    if (req.query.isFreeLesson) {
      qry.isFreeLesson = true;
    }else {
      qry.isFreeLesson = false;
    }
    if (req.query.tutorId) {
      qry.tutorId = ObjectId(req.query.tutorId);
    }
    if (req.query.subjectId) {
      qry.subjectId = ObjectId(req.query.subjectId);
    }
    if (req.query.classMode) {
      qry.classMode = Number(req.query.classMode);
    }
    if (req.query.language) {
      qry.language = Number(req.query.language);
    }
    if (req.query.typeOfClass) {
      qry.typeOfClass = Number(req.query.typeOfClass);
    }
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    let pipeline = [{
        $match: {
          setting: constants.SETTING.PUBLISH,
          status: true,
          isDeleted: false,
          lastDate: { $gte: todayUTC },
          ...qry
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
      }];
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      pipeline.push({
        $match: {
          $or: [
            { topic: searchRegex },
            { searchTags: { $in: [searchRegex] } },
            { "subjects.name": searchRegex }
          ]
        }
       });
      }

    pipeline.push({
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "tutorId",
          foreignField: "tutorId",
          as: "teachingDetail"
        }
      },{
        $unwind: {
          path: "$teachingDetail",
          preserveNullAndEmptyArrays: true
        }
      });

    if (req.user?._id) {
      pipeline.push({
          $lookup: {
            from: "classsaves",
            let: { classId: "$_id" },
            pipeline: [{
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$classId", "$$classId"] },
                      { $eq: ["$parentId", ObjectId(req.user._id)] }
                    ]
                  }
                }
              }],
            as: "saveData"
          }
        },{
          $addFields: {
            isSave: {
              $cond: [{ $gt: [{ $size: "$saveData" }, 0] }, true, false]
            }
          }
        });
       }
      if (req.query.isFreeLesson) {
        pipeline.push({
          $lookup: {
            from: "users",
            localField: "coTutorId",
            foreignField: "_id",
            as: "coTutors"
      }
    },
    {
      $addFields: {
        coTutorCount: { $size: { $ifNull: ["$coTutors", []] } },
        coTutors: {
          $slice: [
            {
              $map: {
                input: "$coTutors",
                as: "t",
                in: {
                  _id: "$$t._id",
                  name: "$$t.name",
                  image: "$$t.image"
                }
              }
            },
            2
          ]
        }
      }
    }
  );
}
    pipeline.push({
        $sort: { createdAt: -1 }
      },{
        $project: {
          thumbnail: 1,
          topic: 1,
          description: 1,
          fees: 1,
          grades: 1,
          classMode: 1,
          "subjects.name": 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "tutor.userName": 1,
          "tutor.image": 1,
          "tutor.followers": 1,
          "tutor.views": 1,
          "tutor.isActive": 1,
          "tutor.avgRating": 1,
          "teachingDetail.specialization": 1,
          isSave: 1,
          isFreeLesson: 1,
          typeOfClass: 1,
          payment: 1,
          duration: 1,
          currency: 1,
          usdPrice: 1,
          coTutorCount: 1,
          coTutors: 1
        }
      });

    if (req.query.type == constants.LIST_TYPE.POPULAR) {
      pipeline.push({
        $sort: {
          shareCount: -1
        }
      });
    } else if (req.query.type == constants.LIST_TYPE_RECOMMENDED) {
      pipeline.push({
        $sort: {
          avgRating: -1
        }
      });
    }

    if (req.query.sortBy) {
      if (req.body.sortBy == constants.SORT_CLASS.DESCENDING) {
        pipeline.push({
          $sort: {
            fees: -1
          }
        });
      } else if (req.query.sortBy == constants.SORT_CLASS.ASCENDING) {
        pipeline.push({
          $sort: {
            fees: 1
          }
        });
      }
    }

    pipeline = await common.pagination(pipeline, skip, limit);
    let [classes] = await Model.Classes.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classes);
  } catch (error) {
    next(error);
  }
};
module.exports.getClassById = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const userId = req.user?._id || null;

    const pipeline = [{
        $match: { _id: ObjectId(req.params.id) }
      },{
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subjects"
        }
      },
      { $unwind: "$subjects" },
      {
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },
      { $unwind: "$tutor" },
      {
        $lookup: {
          from: "teachingdetails",
          localField: "tutorId",
          foreignField: "tutorId",
          as: "teachingDetail"
        }
      },{
        $unwind: {
          path: "$teachingDetail",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "teachingDetail.subjectIds",
          foreignField: "_id",
          as: "tutorSubjects"
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
          from: "users",
          localField: "coTutorId",
          foreignField: "_id",
          as: "coTutor"
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
            }],
          as: "promoCodes"
        }
      }];

    if (userId) {
      pipeline.push({
          $lookup: {
            from: "classsaves",
            let: { classId: "$_id" },
            pipeline: [{
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$classId", "$$classId"] },
                      { $eq: ["$parentId", ObjectId(userId)] }
                    ]
                  }
                }
              }],
            as: "saveData"
          }
        },{
          $addFields: {
            isSave: {
              $cond: [{ $gt: [{ $size: "$saveData" }, 0] }, true, false]
            }
          }
        });
    } else {
      pipeline.push({
        $addFields: { isSave: false }
      });
    }

    if (userId) {
      pipeline.push({
          $lookup: {
            from: "wishlists",
            let: { tutorId: "$tutorId" },
            pipeline: [{
                $match: {
                  $expr: { $eq: ["$tutorId", "$$tutorId"] },
                  parentId: ObjectId(userId)
                }
              }],
            as: "wishlist"
          }
        },{
          $addFields: {
            isFav: { $gt: [{ $size: "$wishlist" }, 0] }
          }
        });
    } else {
      pipeline.push({
        $addFields: {
          wishlist: [],
          isFav: false
        }
      });
    }
    pipeline.push({
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
        grades: 1,
        "subjects._id": 1,
        "subjects.name": 1,
        allOutcome: 1,
        mostOutcome: 1,
        someOutcome: 1,
        material: 1,
        language: 1,
        notes: 1,
        canBePrivate: 1,
        classMode: 1,
        classslots: 1,
        selectedSlots: 1,
        "coTutor._id": 1,
        "coTutor.name": 1,
        "tutor._id": 1,
        "tutor.image": 1,
        "tutor.name": 1,
        "tutor.userName": 1,
        "tutor.followers": 1,
        "tutor.views": 1,
        "tutor.isActive": 1,
        "tutor.avgRating": 1,
        "tutor.bookCount": 1,
        "teachingDetail.specialization": 1,
        "teachingDetail.price": 1,
        "teachingDetail.totalTeachingExperience": 1,
        "teachingDetail.higherEdu": 1,
        "teachingDetail.classes": 1,
        "tutorSubjects.name": 1,
        isFav: 1,
        isFreeLesson: 1,
        typeOfClass: 1,
        payment: 1,
        duration: 1,
        promoCodes: 1,
        isSave: 1,
        currency: 1,
        usdPrice: 1
      }
    });

    const [classData] = await Model.Classes.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classData);
  } catch (error) {
    next(error);
  }
};
module.exports.saveClass = async (req, res, next) => {
  try{
    let lang = req.headers.lang || "en";
    await Validation.Parent.saveClass.validateAsync(req.body);

  const classId = ObjectId(req.body.classId);
  const userId = req.user._id;

  let exists = await Model.ClassSave.findOne({
    parentId: userId,
    classId: classId
  });

  if (exists) {
    await Model.ClassSave.findOneAndRemove({ _id: exists._id });
    return res.success(constants.MESSAGES[lang].CLASS_UNSAVED);
  }

  req.body.parentId = userId;
  const classSave = new Model.ClassSave(req.body);
  await classSave.save();

  return res.success(constants.MESSAGES[lang].CLASS_SAVED, classSave);
  }catch (error) {
    next(error);
  }
};
module.exports.getSaveClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    let pipeline = [{
        $match: {
          parentId: ObjectId(req.user._id)
        }
      },{
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "class"
        }
      },{
        $unwind: {
          path: "$class",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "class.subjectId",
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
          from: "users",
          localField: "class.tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "teachingdetails",
          localField: "class.tutorId",
          foreignField: "tutorId",
          as: "teachingDetail"
        }
      },{
        $unwind: {
          path: "$teachingDetail",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "classslots",
          localField: "class._id",
          foreignField: "classId",
          as: "classSlots"
        }
      },{
        $sort: { "class.createdAt": -1 }
      },{
        $project: {
          _id: "$class._id",
          thumbnail: "$class.thumbnail",
          topic: "$class.topic",
          description: "$class.description",
          fees: "$class.fees",
          classId: "$class.classId",
          "subjects.name": 1,
          "tutor.name": 1,
          "tutor.userName": 1,
          "tutor.followers": 1,
          "tutor.views": 1,
          "tutor.isActive": 1,
          "tutor.avgRating": 1,
          "teachingDetail.specialization": 1,
          classSlots: 1 
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [classes] = await Model.ClassSave.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classes);
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
    
    const today = moment.utc().startOf("day").toDate();
    pipeline.push({
        $match: {
          classId: ObjectId(req.params.id),
          startTime: { $gte: today }
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
module.exports.shareClass = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Parent.saveClass.validateAsync(req.body);
    const classId = ObjectId(req.body.classId);
    await Model.Classes.findByIdAndUpdate(
      classId,
      { $inc: { shareCount: 1 } }
    );

    return res.success(constants.MESSAGES[lang].CLASS_SHARED, {});
  } catch (error) {
    next(error);
  }
};
module.exports.reportClass = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.reportContent.validateAsync(req.body);
    req.body.parentId = req.user._id;
    req.body.status = constants.INQUIRY_STATUS.PENDING;
    const report = await Model.ReportClass.create(req.body);
    return res.success(constants.MESSAGES[lang].REPORT_CREATED, report);
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
    req.body.createdBy = constants.APP_ROLE.PARENT;
    const content = await Model.Content.create(req.body);

    let admin = await Model.Admin.findOne();

    process.emit("sendNotification", {
      adminId: admin._id,
      receiverId: admin._id,
      values: {
        name: req.user.name
      },
      role: constants.ROLE.ADMIN,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.FORUM
    });

    return res.success(constants.MESSAGES[lang].CONTENT_CREATED, content);
  } catch (error) {
    next(error);
  }
};
const getContentAggregationPipeline = ({ matchCondition = {}, userId = null, sortType, search }) => {
  const pipeline = [];
  pipeline.push({ $match: matchCondition });

  // lookup user
  pipeline.push({
    $lookup: {
      from: "users",
      let: { uId: "$userId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$_id", "$$uId"] },
            isBlocked: false,
            isDeleted: false,
            $or: [
              { role: constants.APP_ROLE.PARENT },
              {
                role: constants.APP_ROLE.TUTOR,
                tutorStatus: constants.TUTOR_STATUS.ACCEPTED
              }
            ]
          }
        }
      ],
      as: "user"
    }
  }, {
    $unwind: {
      path: "$user",
      preserveNullAndEmptyArrays: false
    }
  });

  // category + subjects
  pipeline.push({
    $lookup: {
      from: "categories",
      localField: "categoryId",
      foreignField: "_id",
      as: "category"
    }
  }, {
    $unwind: {
      path: "$category",
      preserveNullAndEmptyArrays: true
    }
  }, {
    $lookup: {
      from: "subjects",
      localField: "subjectId",
      foreignField: "_id",
      as: "subjects"
    }
  });

  // poll options
  pipeline.push({
    $lookup: {
      from: "polloptions",
      localField: "_id",
      foreignField: "contentId",
      as: "pollOptions"
    }
  });

  // search filter
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

  if (userId && ObjectId.isValid(userId)) {
    // engagement lookups
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
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$userEngagements",
                  as: "eng",
                  cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.UPVOTE] }
                }
              }
            },
            0
          ]
        },
        isDownvote: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$userEngagements",
                  as: "eng",
                  cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.DOWNVOTE] }
                }
              }
            },
            0
          ]
        },
        isLike: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$userEngagements",
                  as: "eng",
                  cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.LIKE] }
                }
              }
            },
            0
          ]
        },
        isSave: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$userEngagements",
                  as: "eng",
                  cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.SAVE] }
                }
              }
            },
            0
          ]
        }
      }
    });

    // following lookup
    pipeline.push({
      $lookup: {
        from: "follows",
        let: { tutorId: "$user._id" },
        pipeline: [{
          $match: {
            $expr: {
              $and: [
                { $eq: ["$tutorId", "$$tutorId"] },
                { $eq: ["$parentId", ObjectId(userId)] }
              ]
            }
          }
        }],
        as: "followingInfo"
      }
    });

    pipeline.push({
      $addFields: {
        isFollowing: { $gt: [{ $size: "$followingInfo" }, 0] }
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
  }

  // final projection
  pipeline.push({
    $project: {
      images: 1,
      title: 1,
      description: 1,
      topic: 1,
      gradeId: 1,
      "subjects._id": 1,
      "subjects.name": 1,
      "category._id": 1,
      "category.name": 1,
      upVoteCount: 1,
      downVoteCount: 1,
      likeCount: 1,
      commentCount: 1,
      shareCount: 1,
      saveCount: 1,
      createdAt: 1,
      createdBy: 1,
      "user._id": 1,
      "user.image": 1,
      "user.name": 1,
      "user.userName": 1,
      "user.followers": 1,
      "user.avgRating": 1,
      "user.documentVerification": 1,
      "user.isActive": 1,
      question: 1,
      duration: 1,
      isAnonymous: 1,
      uploadType: 1,
      views: 1,
      giftCount: 1,
      votesCount: 1,
      contentType: 1,
      "pollOptions._id": 1,
      "pollOptions.option": 1,
      "pollOptions.votes": 1,
      ...(userId && ObjectId.isValid(userId)
        ? {
            isUpvote: 1,
            isDownvote: 1,
            isLike: 1,
            isSave: 1,
            isFollowing: 1,
            userVotedOptionId: 1
          }
        : {})
    }
  });

  // sorting
  if (sortType === constants.SORT_TYPE.LATEST) {
    pipeline.push({ $sort: { createdAt: -1 } });
  } else if (sortType === constants.SORT_TYPE.OLDEST) {
    pipeline.push({ $sort: { createdAt: 1 } });
  } else if (sortType === constants.SORT_TYPE.MOST_DISCUSSED) {
    pipeline.push({ $sort: { commentCount: -1, createdAt: -1 } });
  }
  return pipeline;
};

module.exports.getContent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    let match = { isDeleted: false, status: true };
    match.contentType = Number(req.query.contentType);

    if (req.query.categoryId) {
      match.categoryId = ObjectId(req.query.categoryId);
    }
    if (req.query.subjectId) {
      match.subjectId = { $in: [ObjectId(req.query.subjectId)] };
    }
    if (req.query.grade) {
      match.gradeId = Number(req.query.grade);
    }

    if(req.query.tutorId){
      match.userId = ObjectId(req.query.tutorId);
    }

    let includeUserIds = null;
    let excludeUserIds = [];

    let activeMutedTutorIds = [];

    if (req.query.contentType == constants.CONTENT_TYPE.FORUM && req.user?._id) {
       if (req.query.type == constants.FORUM_TYPE.SELF) {
          match.userId = req.user._id;
        }
      const mutedTutors = await Model.ShowContent.find(
        {
          parentId: req.user._id,
          type: constants.SHOW_CONTENT.MUTE
        },
        { tutorId: 1, duration: 1, durationType: 1, updatedAt: 1 }
      );

      const now = new Date();

      mutedTutors.forEach((mute) => {
        let muteEnd = new Date(mute.updatedAt);
        let durationMs = 0;
        if (mute.durationType === constants.DURATION_TYPE.HOUR) {
          durationMs = mute.duration * 60 * 60 * 1000;
        } else if (mute.durationType === constants.DURATION_TYPE.DAYS) {
          durationMs = mute.duration * 24 * 60 * 60 * 1000;
        }
        muteEnd = new Date(muteEnd.getTime() + durationMs);

        if (now <= muteEnd) {
          activeMutedTutorIds.push(mute.tutorId);
        }
      });

      if (activeMutedTutorIds.length > 0) {
        match.userId = { ...(match.userId || {}), $nin: activeMutedTutorIds };
      }
      if (activeMutedTutorIds.length > 0) {
      excludeUserIds.push(...activeMutedTutorIds);
    }
    }
    // Teaser or short video content
    if ([constants.CONTENT_TYPE.TEASER_VIDEO, constants.CONTENT_TYPE.SHORT_VIDEO].includes(Number(req.query.contentType))) {
      match.setting = constants.SETTING.PUBLISH;
      match.status = true;

      if (req.query.following && req.user?._id) {
        const followed = await Model.Follow.find({ parentId: req.user._id }, { tutorId: 1 });
        const followedTutorIds = followed.map(f => f.tutorId);
        match.userId = { $in: followedTutorIds };
      }
    }

    // Post content
  if (req.query.contentType == constants.CONTENT_TYPE.POST) {
  if (req.user?._id) {
    const notInterested = await Model.Engagement.find({
      userId: req.user._id,
      engagementType: constants.ENGAGEMENTS.NOT_INTERESTED
    }, { contentId: 1 });

    const notInterestedContentIds = notInterested.map(i => i.contentId);
    if (notInterestedContentIds.length > 0) {
      match._id = { $nin: notInterestedContentIds };
    }

    const blockedTutors = await Model.ShowContent.find({
      parentId: req.user._id,
      type: constants.SHOW_CONTENT.NORMAL
    }, { tutorId: 1 });

    const blockedTutorIds = blockedTutors.map(doc => doc.tutorId);
    if (blockedTutorIds.length > 0) {
      match.userId = { ...(match.userId || {}), $nin: blockedTutorIds };
    }

    const getFollowedTutorIds = async (userId) => {
      const followed = await Model.Follow.find({ parentId: userId }, { tutorId: 1 });
      return followed.map(f => f.tutorId);
    };

    match.$or = [
      { uploadType: constants.UPLOAD_TYPE.POLL }, // Polls: no visibility filter
      {
        $and: [
          { uploadType: { $ne: constants.UPLOAD_TYPE.POLL } }, // Non-poll posts
          {
            $or: [
              { visibility: constants.VISIBILITY.ANYONE },
              {
                $and: [
                  { visibility: constants.VISIBILITY.FOLLOWERS },
                  { userId: { $in: await getFollowedTutorIds(req.user._id) } }
                ]
              }
            ]
          }
        ]
      }
    ];
  }
}
    if (Number(req.query.sortBy) === constants.SORT_TYPE.FOLLOWED_TUTOR && req.user?._id) {
      const followed = await Model.Follow.find({ parentId: req.user._id }, { tutorId: 1 });
      const followedTutorIds = followed.map(f => f.tutorId);
      if (followedTutorIds.length === 0) {
        return res.success(constants.MESSAGES[lang].DATA_FETCHED, { docs: [], total: 0 });
      }
      includeUserIds = followedTutorIds;
      if (req.query.tutorId) {
      includeUserIds = [ObjectId(req.query.tutorId)];
    }
    if (includeUserIds) {
      match.userId = { $in: includeUserIds };
    }
    if (excludeUserIds.length > 0) {
      match.userId = { ...(match.userId || {}), $nin: excludeUserIds };
    }
    }

    let pipeline = getContentAggregationPipeline({
      matchCondition: match,
      userId: req.user?._id || null,
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
    const contentId = ObjectId(req.params.id);

    const pipeline = getContentAggregationPipeline({
      matchCondition: { _id: contentId },
      userId: req.user ? req.user._id : null
    });
    const [content] = await Model.Content.aggregate(pipeline);
    
    if(req.user){
       const alreadyViewed = await Model.ContentViews.findOne({
        contentId: contentId,
        userId: req.user._id
      });

    if (!alreadyViewed) {
      await Model.Content.updateOne(
        { _id: contentId },
        {
          $inc: { views: 1 }
        }
      );
    }
    }
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
      userId: req.user._id,
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
      userId: req.user._id,
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
module.exports.saveContent = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    const userId = req.user._id;

    let pipeline = [{
        $match: {
          userId: ObjectId(userId),
          engagementType: constants.ENGAGEMENTS.SAVE
        }
      },{
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
      }, {
        $match: {
          ...(req.query.contentType && {
            "content.contentType": Number(req.query.contentType)
          })
        }
      },{
        $lookup: {
          from: "users",
          localField: "content.userId",
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
          from: "categories",
          localField: "content.categoryId",
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
          localField: "content.subjectId",
          foreignField: "_id",
          as: "subjects"
        }
      },{
        $lookup: {
          from: "engagements",
          let: { contentId: "$content._id" },
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
      },{
        $addFields: {
          isUpvote: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$userEngagements",
                    as: "eng",
                    cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.UPVOTE] }
                  }
                }
              },
              0
            ]
          },
          isDownvote: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$userEngagements",
                    as: "eng",
                    cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.DOWNVOTE] }
                  }
                }
              },
              0
            ]
          },
          isLike: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$userEngagements",
                    as: "eng",
                    cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.LIKE] }
                  }
                }
              },
              0
            ]
          },
          isSave: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$userEngagements",
                    as: "eng",
                    cond: { $eq: ["$$eng.engagementType", constants.ENGAGEMENTS.SAVE] }
                  }
                }
              },
              0
            ]
          }
        }
      },{
        $lookup: {
          from: "follows",
          let: { tutorId: "$content.user._id" },
          pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tutorId", "$$tutorId"] },
                    { $eq: ["$parentId", ObjectId(userId)] }
                  ]
                }
              }
            }],
          as: "followingInfo"
        }
      },{
        $addFields: {
          isFollowing: { $gt: [{ $size: "$followingInfo" }, 0] }
        }
      },{
        $project: {
          _id: "$content._id",
          images: "$content.images",
          title: "$content.title",
          description: "$content.description",
          topic: "$content.topic",
          uploadType: "$content.uploadType",
          "subjects._id": 1,
          "subjects.name": 1,
          "category._id": 1,
          "category.name": 1,
          upVoteCount: "$content.upVoteCount",
          downVoteCount: "$content.downVoteCount",
          likeCount: "$content.likeCount",
          commentCount: "$content.commentCount",
          shareCount: "$content.shareCount",
          saveCount: "$content.saveCount",
          createdAt: "$content.createdAt",
          createdBy: "$content.createdBy",
          "user._id": 1,
          "user.image": 1,
          "user.name": 1,
          "user.userName": 1,
          "user.followers": 1,
          "user.isActive": 1,
          isAnonymous: "$content.isAnonymous",
          views: "$content.views",
          isUpvote: 1,
          isDownvote: 1,
          isLike: 1,
          isSave: 1,
          isFollowing: 1
        }
      },
      { $sort: { "content.createdAt": -1 } }
    ];

    pipeline = await common.pagination(pipeline, skip, limit);
    const [savedContent] = await Model.Engagement.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, savedContent);

  } catch (error) {
    next(error);
  }
};
module.exports.reportContent = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.reportContent.validateAsync(req.body);
    req.body.parentId = req.user._id;
    req.body.status = constants.INQUIRY_STATUS.PENDING;
    const content = await Model.ReportContent.create(req.body);
    return res.success(constants.MESSAGES[lang].REPORT_CREATED, content);
  } catch (error) {
    next(error);
  }
};

//Content Engagements
function buildNotificationPayload({ req, postDoc, engagementType, commentText }) {
  const parentName = req.user.name || "Someone";
  let pushType = null;
  let values = { name: parentName, contentId: postDoc._id };

  // Decide pushType based on engagementType & contentType
  switch (engagementType) {
    case constants.ENGAGEMENTS.LIKE:
      switch (postDoc.contentType) {
        case constants.CONTENT_TYPE.POST: pushType = constants.PUSH_TYPE_KEYS.LIKE_POST; break;
        case constants.CONTENT_TYPE.FORUM: pushType = constants.PUSH_TYPE_KEYS.LIKE_FORUM; break;
        case constants.CONTENT_TYPE.TEASER_VIDEO: pushType = constants.PUSH_TYPE_KEYS.LIKE_TEASER; break;
        case constants.CONTENT_TYPE.SHORT_VIDEO: pushType = constants.PUSH_TYPE_KEYS.LIKE_SHORT_VIDEO; break;
        default: pushType = constants.PUSH_TYPE_KEYS.LIKE;
      }
      break;

    case constants.ENGAGEMENTS.COMMENT:
      values.commentText = commentText;
      switch (postDoc.contentType) {
        case constants.CONTENT_TYPE.POST: pushType = constants.PUSH_TYPE_KEYS.COMMENT_POST; break;
        case constants.CONTENT_TYPE.FORUM: pushType = constants.PUSH_TYPE_KEYS.COMMENT_FORUM; break;
        case constants.CONTENT_TYPE.TEASER_VIDEO: pushType = constants.PUSH_TYPE_KEYS.COMMENT_TEASER; break;
        case constants.CONTENT_TYPE.SHORT_VIDEO: pushType = constants.PUSH_TYPE_KEYS.COMMENT_SHORT_VIDEO; break;
        default: pushType = constants.PUSH_TYPE_KEYS.COMMENT;
      }
      break;

    default:
      return null; 
  }

  if (!pushType) return null;

  const notificationPayload = {
    values,
    isNotificationSave: true,
    pushType
  };

  if (postDoc.contentType === constants.CONTENT_TYPE.FORUM) {
    if (postDoc.createdBy === constants.ROLE.PARENT) {
      notificationPayload.role = constants.ROLE.PARENT;
      notificationPayload.parentId = postDoc.userId;
    } else {
      notificationPayload.role = constants.ROLE.TUTOR;
      notificationPayload.tutorId = postDoc.userId;
    }
    notificationPayload.receiverId = postDoc.userId;
  } else {
    notificationPayload.role = constants.ROLE.TUTOR;
    notificationPayload.tutorId = postDoc.userId;
    notificationPayload.receiverId = postDoc.userId;
  }
  return notificationPayload;
}
module.exports.engage = async (req, res, next) => {
  const lang = req.headers.lang || "en";
  await Validation.Parent.engage.validateAsync(req.body);

  const { engagementType, commentText, amount, note } = req.body;
  const userId = req.user._id;
  const contentId = ObjectId(req.body.contentId);

  const postDoc = await Model.Content.findById(contentId);
  if (!postDoc) throw new Error(constants.MESSAGES[lang].CONTENT_NOT_FOUND);

  const engagementFilter = { userId, engagementType, contentId };
  const existingEngagement = await Model.Engagement.findOne(engagementFilter);

  let updateQuery = {};
  let link;

  switch (engagementType) {
    case constants.ENGAGEMENTS.UPVOTE: {
      const previousVote = await Model.Engagement.findOne({
        userId,
        contentId,
        engagementType: { $in: [constants.ENGAGEMENTS.UPVOTE, constants.ENGAGEMENTS.DOWNVOTE] }
      });

      if (previousVote) {
        await Model.Engagement.deleteOne({ _id: previousVote._id });
        updateQuery = previousVote.engagementType === constants.ENGAGEMENTS.UPVOTE
          ? { $inc: { upVoteCount: -1 } }
          : { $inc: { upVoteCount: 1, downVoteCount: -1 } };
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
        updateQuery = previousVote.engagementType === constants.ENGAGEMENTS.DOWNVOTE
          ? { $inc: { downVoteCount: -1 } }
          : { $inc: { upVoteCount: -1, downVoteCount: 1 } };
      } else {
        await Model.Engagement.create({ userId, engagementType, contentId });
        updateQuery = { $inc: { downVoteCount: 1 } };
      }
      break;
    }

    case constants.ENGAGEMENTS.LIKE: {
    if (existingEngagement) {
      await Model.Engagement.deleteOne({ _id: existingEngagement._id });
      updateQuery = { $inc: { likeCount: -1 } };
    } else {
      await Model.Engagement.create({ userId, engagementType, contentId });
      updateQuery = { $inc: { likeCount: 1 } };
      // Send notification
      const notificationPayload = buildNotificationPayload({ req, postDoc, engagementType });
      if (notificationPayload) process.emit("sendNotification", notificationPayload);
    }
    break;
  }

  case constants.ENGAGEMENTS.COMMENT: {
    if (!commentText || commentText.trim() === "")
      throw new Error(constants.MESSAGES[lang].COMMENT_TEXT_REQUIRED);

    await Model.Comment.create({ userId, contentId, commentText });
    updateQuery = { $inc: { commentCount: 1 } };

    // Send notification
    const notificationPayload = buildNotificationPayload({ req, postDoc, engagementType, commentText });
    if (notificationPayload) process.emit("sendNotification", notificationPayload);
    break;
  }

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

    case constants.ENGAGEMENTS.GIFT: {
      const giftPayload = { userId, contentId, grandTotal: amount, note, bookType: constants.BOOK_TYPE.GIFT };
      const cartId = functions.generateRandomCustom(10);
      const cartData = { cartId, parentId: userId, body: giftPayload };

      await Model.Cart.deleteMany({ parentId: userId });
      await Model.Cart.create(cartData);
      link = await cart.generatePaymentLink(cartData, req.user);
      await Model.Cart.findOneAndUpdate({ parentId: userId }, { $set: { order_tracking_id: link.order_tracking_id } }, { new: true });
      break;
    }

    case constants.ENGAGEMENTS.NOT_INTERESTED:
      if (!existingEngagement) await Model.Engagement.create({ userId, contentId, engagementType });
      break;

    case constants.ENGAGEMENTS.SHOW_CONTENT:
      if (!(await Model.ShowContent.findOne({ parentId: userId, tutorId: postDoc.userId, type: constants.SHOW_CONTENT.NORMAL }))) {
        await Model.ShowContent.create({ parentId: userId, tutorId: postDoc.userId, type: constants.SHOW_CONTENT.NORMAL });
      }
      break;

    case constants.ENGAGEMENTS.MUTE: {
      const { duration, durationType } = req.body;
      const muteDoc = await Model.ShowContent.findOne({ parentId: userId, tutorId: postDoc.userId, type: constants.SHOW_CONTENT.MUTE });

      if (muteDoc) {
        muteDoc.duration = duration;
        muteDoc.durationType = durationType;
        muteDoc.createdAt = new Date();
        await muteDoc.save();
      } else {
        await Model.ShowContent.create({ parentId: userId, tutorId: postDoc.userId, type: constants.SHOW_CONTENT.MUTE, duration, durationType });
      }
      break;
    }
    default:
      throw new Error(constants.MESSAGES[lang].INVALID_ENGAGEMENT_TYPE);
  }

  if (Object.keys(updateQuery).length) {
    await Model.Content.updateOne({ _id: contentId }, updateQuery);
  }

  return res.success(constants.MESSAGES[lang].ENGAGEMENT_SUCCESS, { contentId, engagementType, link });
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
    const userId = req.user ? req.user._id : null;

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
            }
          ],
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
          likeCount: 1,
          commentReply: 1,
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

//Follow
module.exports.follow = async (req, res, next) => {
  let lang = req.headers.lang || "en";
  await Validation.Parent.follow.validateAsync(req.body);

  const tutorId = ObjectId(req.body.tutorId);
  const userId = req.user._id;

  let exists = await Model.Follow.findOne({
    parentId: userId,
    tutorId: tutorId
  });

  if (exists) {
    await Model.Follow.findOneAndRemove({ _id: exists._id });

    await Model.User.updateOne(
      { _id: tutorId },
      { $inc: { followers: -1 } }
    );
    return res.success(constants.MESSAGES[lang].USER_UNFOLLOWED);
  }

  req.body.parentId = userId;
  const follow = new Model.Follow(req.body);
  await follow.save();

  await Model.User.updateOne(
    { _id: tutorId },
    { $inc: { followers: 1 } }
  );

    process.emit("sendNotification", {
      tutorId: tutorId,
      receiverId: tutorId,
      values: {followerName: req.user.name},
      role: constants.ROLE.TUTOR,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.FOLLOW
    });

  return res.success(constants.MESSAGES[lang].USER_FOLLOWED, follow);
};

//Promocode
module.exports.getPromoCode = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let pipeline = [];
    let qry = {};

    if (req.query.tutorId) {
      qry.tutorId = ObjectId(req.query.tutorId);
    }

    if (req.query.type == constants.PROMOCODE_TYPE.ONE_TO_ONE) {
      qry.type = {
        $in: [constants.PROMOCODE_TYPE.ONE_TO_ONE, constants.PROMOCODE_TYPE.BOTH]
      };
    }

    if (req.query.classId) {
      qry.$or = [
        { classIds: ObjectId(req.query.classId) },
        { allClasses: true }
      ];
      qry.type = {
        $in: [constants.PROMOCODE_TYPE.ONE_TO_ONE, constants.PROMOCODE_TYPE.BOTH]
      };
    }

    if(req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      qry.$or = [
        { name: searchRegex },
        { codeName: searchRegex }
      ];
    }

    const now = new Date();
    pipeline.push({
      $match: {
        isDeleted: false,
        status: true,
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
        discountType: 1,
        discount: 1,
        maxUser: 1,
        usedCount: 1,
        expiryDate: 1,
        startDate: 1,
        type: 1,
        setting: 1,
        allClasses: 1,
        classIds: 1,
        createdAt: 1,
        status: 1
      }
    });

    pipeline = await common.pagination(pipeline, skip, limit);
    const [promoCode] = await Model.PromoCode.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promoCode);
  } catch (error) {
    next(error);
  }
};

//Inquiry
module.exports.createInquiry = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.addInquiry.validateAsync(req.body);

    if(req.user){
      req.body.parentId = req.user._id;
    }else{
      req.body.isGuest = true;
    }
    req.body.status = constants.INQUIRY_STATUS.PENDING;
    const inquiry = await Model.Inquiry.create(req.body);
    return res.success(constants.MESSAGES[lang].INQUIRY_ADDED_SUCCESSFULLY, inquiry);
  } catch (error) {
    next(error);
  }
};
module.exports.getInquiry = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];

    pipeline.push({
        $match: {
          parentId: req.user._id
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
          preserveNullAndEmptyArrays: true
        }
      },{  
          $sort: {
            createdAt: -1
        }
      },{
        $project: {
          "tutor.image": 1,
          "tutor.name": 1,
          "tutor.userName": 1,
          type: 1,
          status: 1,
          other: 1,
          revert: 1,
          tutorRevert: 1,
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
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
          preserveNullAndEmptyArrays: true
        }
      },{
        $project: {
         "tutor.image": 1,
         "tutor.name": 1,
         "tutor.userName": 1,
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

//Class Booking
module.exports.classBooking = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.classBooking.validateAsync(req.body);
    const active = await Model.Classes.findOne({
      _id: ObjectId(req.body.bookClassId),
      status: true,
      isDeleted: false
    });
    if (!active) {
      throw new Error(constants.MESSAGES[lang].CLASS_IS_NOT_ACTIVE);
    }
    const parentId = req.user._id;
    req.body.parentId = parentId;
    req.body.bookedBy = parentId;
    const countryISOCode = req.user?.countryISOCode || 'US';
    let setting = await Model.AppSetting.findOne({
      countryCode: countryISOCode,
      isDeleted: false
    }).select("serviceFees serviceType distanceAmount distanceType");
    const serviceType = setting.serviceType;
    const servicePrice = setting.serviceFees;

    const slotIds = req.body.classSlotIds || [];
    const slots = await Model.ClassSlots.find({
      _id: { $in: slotIds.map(id => ObjectId(id)) },
      classId: active._id
    });

    if (!slots.length) {
      throw new Error("Selected class slots not found.");
    }
    let classPrice = active.totalFees * slots.length;
    if (active.currency && active.currency !== "USD") {
      classPrice = await functions.convertCurrency(classPrice, active.currency);
    }
    let discountAmount = 0;
    let promo = null;

    if (req.body.promocodeId) {
      promo = await Model.PromoCode.findOne({
        _id: ObjectId(req.body.promocodeId),
        status: true,
        isDeleted: false,
        expiryDate: { $gte: new Date() }
      }).select("discountType discount maxUser usedCount");
      if (!promo) {
        throw new Error(constants.MESSAGES[lang].PROMO_CODE_INVALID);
      }
      if(promo.maxUser == promo.usedCount) {
        throw new Error(constants.MESSAGES[lang].PROMO_CODE_INVALID);
      }
      if (promo.discountType === constants.SERVICE_TYPE.FLAT) {
        discountAmount = promo.discount;
      } else if (promo.discountType === constants.SERVICE_TYPE.PERCENT) {
        discountAmount = (promo.discount * classPrice) / 100;
      }
      if (discountAmount > classPrice) throw new Error(constants.MESSAGES[lang].PROMO_EXCEEDS_TOTAL);
        req.body.promocodeId = promo._id;
        req.body.discountType = promo.discountType;
      }
    const grandTotal = classPrice - discountAmount;
    let serviceAmount = 0;
    if (servicePrice > 0) {
      if (serviceType === constants.SERVICE_TYPE.FLAT) {
        serviceAmount = grandTotal * slots.length;
      } else if (serviceType === constants.SERVICE_TYPE.PERCENT) {
        serviceAmount = (servicePrice * grandTotal) / 100;
      }
    }
    const tutorMoney = grandTotal - serviceAmount;
    req.body.bookingNumber = functions.generateBookingId();
    req.body.classPrice = classPrice;
    req.body.discountAmount = discountAmount;
    req.body.grandTotal = grandTotal;
    req.body.serviceFees = serviceAmount;
    req.body.tutorMoney = tutorMoney;
    req.body.serviceCharges = servicePrice;
    req.body.serviceType = serviceType;
    req.body.bookType = constants.BOOK_TYPE.CLASS;
    req.body.classSlotIds = slotIds;
    req.body.tutorId = active.tutorId;
    req.body.subjectId = active.subjectId;
    let booking;
    let link;
      if (req.query.isCartScreen === "true") {
        booking = req.body;
      } else {
        if(active.isFreeLesson){
          await paymentCommon.classBook({ body: req.body });  
        }else{
          const cartId = functions.generateRandomCustom(10);
          const cartData = {
            cartId,
            parentId,
            body: req.body
        };
        await Model.Cart.deleteMany({ parentId });
        await Model.Cart.create(cartData);
        link = await cart.generatePaymentLink(cartData, req.user);
        await Model.Cart.findOneAndUpdate(
          { parentId },
          { $set: { order_tracking_id: link.order_tracking_id } },
          { new: true }
        );
      }
    }
    const data = {
      booking,
      link,
      setting
    };

    if (req.body.promocodeId) {
      data.promo = promo;
    }
    return res.success(constants.MESSAGES[lang].BOOKING_ADDED, data);
  } catch (error) {
    next(error);
  }
};
module.exports.getBookedClasses = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let qry = {};
    if (req.query.classModeOnline == 'true') {
      qry.classModeOnline = true;
    } else if (req.query.classModeOnline == 'false') {
      qry.classModeOnline = false;
    }

    let pipeline = [{
        $match: {
          parentId: req.user._id,
          bookType: constants.BOOK_TYPE.CLASS,
          ...qry
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
          preserveNullAndEmptyArrays: false
        }
      },{
        $lookup: {
          from: "classes",
          localField: "bookClassId",
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
          from: "classslots",
          localField: "classSlotIds",
          foreignField: "_id",
          as: "classSlots"
        }
      },{
        $unwind: {
          path: "$classSlots",
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
      }];
    if (req.query.date) {
      const formattedDate = moment.utc(req.query.date).format('YYYY-MM-DD');
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
      $project: {
        tutor: { _id: 1, userName: 1 },
        subjectId: { name: 1 },
        bookType: 1,
        classData: {
          _id: 1,
          topic: 1,
          dyteMeeting: 1,
          address: 1,
          latitude: 1,
          longitude: 1
        },
        classSlots: {
          _id: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          timezone: 1,
          seats: 1,
          remainingSeats: 1
        }
      }
    });
    let booking = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
  } catch (error) {
    next(error);
  }
};
module.exports.bookClassById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          _id: ObjectId(req.params.id),
          parentId: req.user._id
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },{
        $unwind: {
          path: "$tutor",
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
        $lookup: {
          from: "teachingdetails",
          localField: "tutorId",
          foreignField: "tutorId",
          as: "teachingDetail"
        }
      },{
        $unwind: {
          path: "$teachingDetail",
          preserveNullAndEmptyArrays: true
        }
      },{
        $sort: { createdAt: -1 }
      },{
        $project: {
          tutor: { 
            _id: 1, 
            name: 1, 
            image: 1, 
            userName: 1,
            followers: 1,
            views: 1,
            isActive: 1,
            avgRating: 1
           },
          teachingDetail:{ 
            price: 1
          },
          subjectId: { name: 1 },
          createdAt: 1,
          discountAmount: 1,
          classPrice: 1,
          grandTotal: 1,
          invoiceNo: 1,
          classModeOnline: 1,
          tutorMoney: 1,
          serviceType: 1,
          serviceCharges: 1,
          address: 1,
          bookingNumber: 1,
          classSlots: {
            _id: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            timezone: 1
          },
          classData: {
            _id: 1,
            topic: 1,
            description: 1,
            thumbnail: 1,
            fees: 1,
            language: 1,
            address: 1,
            classId: 1,
            duration: 1
          }
        }
      }];
    let [booking] = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
  } catch (error) {
    next(error);
  }
};

//Banner
module.exports.banner = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];
    pipeline.push({
      $match: {
        status: true,
        isDeleted: false
      }
    },{
        $project: {
          title: 1,
          description: 1,
          image: 1,
          buttonText: 1,
          createdAt: 1,
          status: 1
        }
      });
    let [banner] = await Model.Banner.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, banner);
  } catch (error) {
    next(error);
  }
};

//Listing
module.exports.catSubList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const type = Number(req.query.type);
    let data;

    let qry = {};
    switch (type) {
      case constants.LISTING.CATEGORY:
        data = await Model.Category.find({
          isDeleted: false,
          status: true
        }).select("name");
        break;

      case constants.LISTING.SUBJECT:
        if (req.query.categoryId) {
          qry.categoryId = ObjectId(req.query.categoryId);
        }
        data = await Model.Subjects.find({
          isDeleted: false,
          status: true,
          ...qry
        }).select("name");
        break;

      case constants.LISTING.TUTOR_SUBJECT: {
        const teachingDetail = await Model.TeachingDetails.findOne({
          tutorId: ObjectId(req.query.tutorId)
        });
          data = await Model.Subjects.find({
            _id: { $in: teachingDetail.subjectIds },
            isDeleted: false,
            status: true
          }).select("name");
        break;
      }
      default:
        return res.success(constants.MESSAGES[lang].DATA_FETCHED, []);
    }

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, data);
  } catch (error) {
    next(error);
  }
};

//Social Links
module.exports.socialLinks = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];

    pipeline.push({
        $match: {
          tutorId: ObjectId(req.query.tutorId),
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

//Block Report Chat
module.exports.blockReportChat = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Parent.blockChat.validateAsync(req.body);
    
    req.body.parentId = req.user._id;
    req.body.reportBy = constants.APP_ROLE.PARENT;

    if(req.body.type == constants.CHAT_REPORT.REPORT){
      const reportChat = await Model.ReportChat.create(req.body);
      return res.success(constants.MESSAGES[lang].CHAT_REPORT_SUCCESSFULLY, reportChat);
    }else if(req.body.type == constants.CHAT_REPORT.BLOCK){
      await Model.ChatMessage.updateMany({
        connectionId: req.body.chatId
      },{
        isTutorBlocked: true
      });
      const reportChat = await Model.ReportChat.create(req.body);
      await Model.Follow.deleteOne({
        parentId: req.user._id,
        tutorId: ObjectId(req.body.tutorId) 
      });
      return res.success(constants.MESSAGES[lang].CHAT_BLOCKED_SUCCESSFULLY, reportChat);
    }else if(req.body.type == constants.CHAT_REPORT.UNBLOCK){
      await Model.ChatMessage.updateMany({
        connectionId: req.body.chatId
      },{
        isTutorBlocked: false
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
      agreeChat.parent = true;
      agreeChat.save();
    }else{
      req.body.parent = true;
      agreeChat = await Model.ChatAgreement.create(req.body);
    }
    return res.success(constants.MESSAGES[lang].I_UNDERSTAND, agreeChat);
   
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






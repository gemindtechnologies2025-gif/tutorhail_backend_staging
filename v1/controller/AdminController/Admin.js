const Model = require("./../../../models/");
const Auth = require("../../../common/authenticate");
const Validation = require("../../validations");
const constants = require("../../../common/constants");
const functions = require("../../../common/functions");
const services = require("../../../services/index");
const subAdmin = require("../../../services/SubAdmin");
const common = require('../../../services/common');
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const aws = require("aws-sdk");
const jsonexport = require("jsonexport");
const axios = require("axios");
const moment = require('moment');
const pdf = require("html-pdf-node");

// Helper function to get document type name
const getDocumentTypeName = (documentType) => {
  switch (documentType) {
    case constants.DOCUMENT_TYPE.ID_PROOF:
      return "ID Proof";
    case constants.DOCUMENT_TYPE.ACHIEVEMENTS:
      return "Achievements";
    case constants.DOCUMENT_TYPE.CERTIFICATES:
      return "Certificates";
    case constants.DOCUMENT_TYPE.VERIFICATION_DOCS:
      return "Verification Documents";
    default:
      return "Document";
  }
};
const fs = require("fs");
const cart = require('../PaymentController/pesapalPayment');
const { classSlots } = require("../ParentController/Parent");

//Signup the admin using email.
module.exports.register = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.register.validateAsync(req.body);
    if (req.body.email) {
      const checkEmail = await Model.Admin.findOne({
        email: req.body.email.toLowerCase(),
        isDeleted: false
      });
      if (checkEmail) throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
    }
    req.body.role = constants.ROLE.ADMIN;
    const create = await Model.Admin(req.body).save();
    //Convert password to hash using bcrypt.
    await create.setPassword(req.body.password);
    await create.save();
    delete create.password;
    return res.success(constants.MESSAGES[lang].PROfILE_CREATED_SUCCESSFULLY, create);
  } catch (error) {
    next(error);
  }
};
//Login the admin using phoneNo/Email.
module.exports.login = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.login.validateAsync(req.body);
    let doc = await Model.Admin.findOne({
      email: req.body.email.toLowerCase(),
      isDeleted: false
    });
    if (!doc) {
      throw new Error(constants.MESSAGES[lang].INVALID_CREDENTIALS);
    }
    await doc.authenticate(req.body.password);
    if (doc.isBlocked) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
    }
    //Create a new JTI for single session timeout
    doc.loginCount += 1;
    doc.jti = functions.generateRandomStringAndNumbers(25);
    if (req.body.deviceToken && req.body.deviceType) {
      doc.deviceToken = req.body.deviceToken;
      doc.deviceType = req.body.deviceType;
    }
    await doc.save();
    doc = JSON.parse(JSON.stringify(doc));
    doc.accessToken = await Auth.getToken({
      _id: doc._id,
      jti: doc.jti,
      role: constants.ROLE.ADMIN,
      secretId: req.headers.deviceId
    });
    delete doc.password;
    return res.success(constants.MESSAGES[lang].LOGIN_SUCCESS, doc);
  } catch (error) {
    next(error);
  }
};
//Logout the current admin and change the JTI, Also remove the current device type and device token.
module.exports.logout = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Model.Admin.updateOne({
      _id: req.admin._id,
      isDeleted: false
    }, {
      deviceToken: "",
      deviceType: "",
      jti: ""
    });
    return res.success(constants.MESSAGES[lang].LOGOUT_SUCCESS);
  } catch (error) {
    next(error);
  }
};
//Get the complete profile of the current admin.
module.exports.getProfile = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const doc = await Model.Admin.findOne({
      _id: req.admin._id,
      isDeleted: false
    }, {
      password: 0
    });
    if (!doc) throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    if (doc.isBlocked) throw new Error(constants.MESSAGES[lang].ACCOUNT_BLOCKED);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, doc);
  } catch (error) {
    next(error);
  }
};
//Update the admin details.
module.exports.updateProfile = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.updateProfile.validateAsync(req.body);
    const nin = {
      $nin: [req.admin._id]
    };
    if (req.body.email) {
      const checkEmail = await Model.Admin.findOne({
        _id: nin,
        email: req.body.email.toLowerCase(),
        isDeleted: false
      });
      if (checkEmail) throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
    }
    if (req.body.phoneNo) {
      const checkPhone = await Model.Admin.findOne({
        _id: nin,
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isDeleted: false
      });
      if (checkPhone) throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
    }
    delete req.body.password;
    const updated = await Model.Admin.findOneAndUpdate({
      _id: req.admin._id
    }, {
      $set: req.body
    }, {
      new: true
    });
    return res.success(
      constants.MESSAGES[lang].PROFILE_UPDATED_SUCCESSFULLY,
      updated
    );
  } catch (error) {
    next(error);
  }
};
//Change the old password with the new one.F
module.exports.changePassword = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.changePassword.validateAsync(req.body);
    if (req.body.oldPassword == req.body.newPassword)
      throw new Error(constants.MESSAGES[lang].PASSWORDS_SHOULD_BE_DIFFERENT);

    const doc = await Model.Admin.findOne({
      _id: req.admin._id
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
//Reset password in case of forgot.
module.exports.resetPassword = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.resetPassword.validateAsync(req.body);
    const doc = await Model.Admin.findOne({
      _id: req.admin._id
    });
    if (!doc) throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    await doc.setPassword(req.body.newPassword);
    await doc.save();
    return res.success(constants.MESSAGES[lang].PASSWORD_RESET);
  } catch (error) {
    next(error);
  }
};
module.exports.sendOtp = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.forgotPassword.validateAsync(req.body);
    const check = await Model.Admin.findOne({
      email: req.body.email.toLowerCase(),
      isDeleted: false
    });

    if (check == null) throw new Error(constants.MESSAGES[lang].EMAIL_NOT_FOUND);
    let payload = {
      email: req.body.email.toLowerCase(),
      name: check.firstName ? check.firstName : check.email
    };
    services.EmalService.forgotPasswordEmail(payload);
    return res.success(constants.MESSAGES[lang].OTP_SENT);
  } catch (error) {
    next(error);
  }
};
module.exports.verifyOtp = async (req, res, next) => {
  try {
    let lang = req.headers.language || "en";
    let data = null;
    let qry = {
      otp: req.body.otp
    };
    if (req.body.email) {
      qry.email = req.body.email.toLowerCase();
    }
    //Check if user has sent any otp for verification.
    let otp = await Model.Otp.findOne(qry);
    if (!otp) {
      throw new Error(constants.MESSAGES[lang].INVALID_OTP);
    }
    if (otp) await Model.Otp.findByIdAndRemove(otp._id);
    if (req.body.email) {
      data = await Model.Admin.findOneAndUpdate({
        email: req.body.email.toLowerCase(),
        isDeleted: false
      }, {
        $set: {
          isEmailVerified: true
        }
      }, {
        new: true
      });
    }
    if (data == null) {
      throw new Error(constants.MESSAGES[lang].ACCOUNT_NOT_FOUND);
    }
    data.jti = functions.generateRandomCustom(25);
    if (req.headers.deviceid) {
      data.deviceid = req.headers.deviceid;
    }
    await data.save();
    data = JSON.parse(JSON.stringify(data));
    data.accessToken = await Auth.getToken({
      _id: data._id,
      role: constants.ROLE.ADMIN,
      jti: data.jti,
      secretId: req.headers.deviceid
    });
    return res.success(constants.MESSAGES[lang].VERIFIED_OTP, data);
  } catch (error) {
    next(error);
  }
};

//CMS data.
module.exports.addCms = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    //Add Cms pages data
    let dataObject = {};
    let addCms = null;
    if (req.body.privacyPolicy != null && req.body.privacyPolicy != "")
      dataObject.privacyPolicy = req.body.privacyPolicy;
    if (
      req.body.termsAndConditions != null &&
      req.body.termsAndConditions != ""
    )
      dataObject.termsAndConditions = req.body.termsAndConditions;
    if (req.body.aboutUs != null && req.body.aboutUs != "")
      dataObject.aboutUs = req.body.aboutUs;
    if (req.body.eula != null && req.body.eula != "")
      dataObject.eula = req.body.eula;
    if (req.body.contactSupport != null && req.body.contactSupport != "")
      dataObject.contactSupport = req.body.contactSupport;
    if (req.body.cancellationPolicy != null && req.body.cancellationPolicy != "")
      dataObject.cancellationPolicy = req.body.cancellationPolicy;
    if (req.body.refundPolicy != null && req.body.refundPolicy != "")
      dataObject.refundPolicy = req.body.refundPolicy;
    if (req.body.faq != null && req.body.faq.length != 0)
      dataObject.faq = req.body.faq;
    if (req.body.dataProcessingAgreement != null && req.body.dataProcessingAgreement != "")
      dataObject.dataProcessingAgreement = req.body.dataProcessingAgreement;
    if (req.body.communityGuidelines != null && req.body.communityGuidelines != "")
      dataObject.communityGuidelines = req.body.communityGuidelines;
    if (req.body.cookiePolicy != null && req.body.cookiePolicy != "")
      dataObject.cookiePolicy = req.body.cookiePolicy;

    // Update timestamp fields when content is updated
    if (dataObject.dataProcessingAgreement) {
      dataObject.dataProcessingAgreementUpdatedAt = new Date();
    }
    if (dataObject.communityGuidelines) {
      dataObject.communityGuidelinesUpdatedAt = new Date();
    }
    if (dataObject.cookiePolicy) {
      dataObject.cookiePolicyUpdatedAt = new Date();
    }

    addCms = await Model.Cms.findOneAndUpdate({}, dataObject, {
      upsert: true,
      new: true
    });
    return res.success(constants.MESSAGES[lang].SUCCESS, addCms);
  } catch (error) {
    next(error);
  }
};
module.exports.getCms = async (req, res, next) => {
  try {
    //Fetch data without permission because cms pages need to be build for the app/web.
    let lang = req.headers.lang || "en";
    const cmsData = await Model.Cms.findOne({});
    
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, cmsData);
  } catch (error) {
    next(error);
  }
};

//dashboard
module.exports.dashboard = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let data;
     const today = moment();
      const startOfToday = new Date(today.startOf("day"));
      const startOfWeek = new Date(today.startOf("week"));
      const endOfWeek = new Date(today.endOf("week"));
      const startOfMonth = new Date(today.startOf("month"));
      const endOfMonth = new Date(today.endOf("month"));
      const startOfYear = new Date(today.startOf("year"));
      const endOfYear = new Date(today.endOf("year"));

      const getDateRange = (type) => {
        switch (type) {
          case "daily":
            return { $gte: startOfToday };
          case "weekly":
            return { $gte: startOfWeek, $lte: endOfWeek };
          case "monthly":
            return { $gte: startOfMonth, $lte: endOfMonth };
          case "yearly":
            return { $gte: startOfYear, $lte: endOfYear };
          default:
            return null;
        }
      };
    const dateRange = getDateRange(req.query.type);
    if(req.query.dashboardType == constants.DASHBOARD_TYPE.OVERALL){
    let totalUsers = await Model.User.countDocuments({
       isDeleted: false,
       role: constants.APP_ROLE.PARENT,
       ...(dateRange ? { createdAt: dateRange } : {})
      });
    let totalTutors = await Model.User.countDocuments({ 
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
    let totalBookings = await Model.Booking.countDocuments({
      ...(dateRange ? { createdAt: dateRange } : {})
    });
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    let newBookings = await Model.Booking.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });
    let totalRevenue = await Model.Booking.aggregate([
      {
        $match: {
          bookingStatus: constants.BOOKING_STATUS.COMPLETED,
          ...(dateRange ? { createdAt: dateRange } : {})
        }
      },{
        $group: {
          _id: null,
          earning: { $sum: "$grandTotal" }
        }
      },
      { $project: { _id: 0 } }
    ]);
    let todayRevenue = await Model.Booking.aggregate([
      {
        $match: {
          bookingStatus: constants.BOOKING_STATUS.COMPLETED,
          updatedAt: { $gte: startOfToday, $lte: endOfToday }
        }
      },{
        $group: {
          _id: null,
          earning: { $sum: "$grandTotal" }
        }
      },
      { $project: { _id: 0 } }
    ]);
    let acceptedBookings = await Model.Booking.countDocuments({
      bookingStatus: constants.BOOKING_STATUS.ACCEPTED,
      ...(dateRange ? { acceptedAt: dateRange } : {})
    });
    let pendingBookings = await Model.Booking.countDocuments({
      bookingStatus: constants.BOOKING_STATUS.PENDING,
      ...(dateRange ? { createdAt: dateRange } : {})
    });
    let rejectedBookings = await Model.Booking.countDocuments({
      bookingStatus: {
        $in: [constants.BOOKING_STATUS.REJECTED, constants.BOOKING_STATUS.CANCELLED]
      },
      ...(dateRange ? { cancelledAt: dateRange } : {})
    });
    let ongoingBookings = await Model.Booking.countDocuments({
      bookingStatus: constants.BOOKING_STATUS.ONGOING,
      ...(dateRange ? { createdAt: dateRange } : {})
    });
    let completedBookings = await Model.Booking.countDocuments({
      bookingStatus: constants.BOOKING_STATUS.COMPLETED,
      ...(dateRange ? { completedAt: dateRange } : {})
    });
    let totalNoOfHours = await Model.Booking.aggregate([
      {
        $match: {
          bookingStatus: constants.BOOKING_STATUS.COMPLETED,
          ...(dateRange ? { createdAt: dateRange } : {})
        }
      },{
        $group: {
          _id: null,
          totalHours: { $sum: "$totalNoOfHours" }
        }
      },
      { $project: { _id: 0 } }
    ]);
    let deletedUsers = await Model.User.countDocuments({
      isDeleted: true,
       role: constants.APP_ROLE.PARENT,
      ...(dateRange ? { deletedAt: dateRange } : {})
     });
    let deletedTutors = await Model.User.countDocuments({ 
      isDeleted: true,
      role: constants.APP_ROLE.TUTOR,
     ...(dateRange ? { deletedAt: dateRange } : {})
    });
    let acceptedTutors = await Model.User.countDocuments({ 
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR,
      tutorStatus: constants.TUTOR_STATUS.ACCEPTED,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
     let rejectedTutors = await Model.User.countDocuments({ 
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR,
      tutorStatus: constants.TUTOR_STATUS.REJECTED,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
      let pendingTutors = await Model.User.countDocuments({ 
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR,
      tutorStatus: constants.TUTOR_STATUS.PENDING,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
     let totalInquiry = await Model.Inquiry.countDocuments({ 
       isDeleted: false,
       ...(dateRange ? { createdAt: dateRange } : {})
     });
     let reportContent = await Model.ReportContent.countDocuments({ 
        isDeleted: false,
       ...(dateRange ? { createdAt: dateRange } : {})
     });
     let reportTutor = await Model.ReportTutor.countDocuments({ 
      isDeleted: false,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
    let reportChat = await Model.ReportChat.countDocuments({ 
      isDeleted: false,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
    let totalReports = reportContent + reportTutor + reportChat;
    let verifiedTutors = await Model.User.countDocuments({ 
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR,
      documentVerification: true,
      ...(dateRange ? { createdAt: dateRange } : {})
     });
    data = {
      totalUsers,
      totalTutors,
      totalBookings,
      newBookings,
      totalRevenue: totalRevenue[0]?.earning || 0,
      todayRevenue: todayRevenue[0]?.earning || 0,
      acceptedBookings,
      pendingBookings,
      rejectedBookings,
      ongoingBookings,
      completedBookings,
      deletedUsers,
      deletedTutors,
      totalNoOfHours: totalNoOfHours[0]?.totalHours || 0,
      acceptedTutors,
      rejectedTutors,
      totalInquiry,
      totalReports,
      verifiedTutors,
      pendingTutors
    };
    }else if(req.query.dashboardType == constants.DASHBOARD_TYPE.TUTOR){
      let profileViews = await Model.TutorViews.countDocuments({
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      let followers = await Model.Follow.countDocuments({
        ...(dateRange ? { createdAt: dateRange } : {})
      });

      const tutorEarning = await Model.User.aggregate([
      { $match: { role: constants.APP_ROLE.TUTOR,
         ...(dateRange ? { createdAt: dateRange } : {})
       } },
      {
        $group: {
          _id: null,
          totalGiftsEarn: { $sum: "$giftsEarn" },
          totalClassEarn: { $sum: "$classEarn" },
          totalOneOnOneEarn: { $sum: "$oneOnOneEarn" }
        }
      },{
        $project: {
          _id: 0,
          totalGiftsEarn: 1,
          totalClassEarn: 1,
          totalOneOnOneEarn: 1,
          totalEarning: {
            $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"]
          },
          giftsPercent: {
            $cond: [
              { $eq: [{ $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }, 0] },
              0,
              { $multiply: [{ $divide: ["$totalGiftsEarn", { $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }] }, 100] }
            ]
          },
          classPercent: {
            $cond: [
              { $eq: [{ $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }, 0] },
              0,
            { $multiply: [{ $divide: ["$totalClassEarn", { $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }] }, 100] }
            ]
          },
          oneOnOnePercent: {
            $cond: [
              { $eq: [{ $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }, 0] },
              0,
            { $multiply: [{ $divide: ["$totalOneOnOneEarn", { $add: ["$totalGiftsEarn", "$totalClassEarn", "$totalOneOnOneEarn"] }] }, 100] }
            ]
          }
          }
        }
      ]);

      const avgRatingAgg = await Model.User.aggregate([
        { $match: { role: constants.APP_ROLE.TUTOR, avgRating: { $ne: 0 },  ...(dateRange ? { createdAt: dateRange } : {})} },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$avgRating" }
          }
        },{
          $project: {
          _id: 0,
          averageRating: 1
          }
        }
      ]);
      const averageRating = avgRatingAgg[0]?.averageRating || 0;

      const ratingCountAgg = [{
        $match: {
        role: constants.APP_ROLE.TUTOR,
        avgRating: { $ne: 0 },
        ...(dateRange ? { createdAt: dateRange } : {})
        }
      },{
        $group: {
          _id: {
            $concat: [
              { $toString: { $min: [5, { $max: [1, { $floor: "$avgRating" }] }] } }, 
              "_star"
            ]
          },
        count: { $sum: 1 }
        }
      }];
      const ratingCounts = await Model.User.aggregate(ratingCountAgg);
      
      data = {
        profileViews,
        followers,
        tutorEarning,
        averageRating,
        ratingCounts
      };
    }else if(req.query.dashboardType == constants.DASHBOARD_TYPE.CLASS){
      const activeStudentsAgg = await Model.Booking.aggregate([
        {
          $match: {
            bookType: constants.BOOK_TYPE.CLASS,
            ...(dateRange ? { createdAt: dateRange } : {})
          }
        },{
          $group: {
            _id: "$parentId"
          }  
        },{
          $count: "activeStudents"
        }
      ]);
      const activeStudents = activeStudentsAgg[0]?.activeStudents || 0;
      
      let totalClasses = await Model.Classes.countDocuments({ 
        isDeleted: false,
        setting: constants.SETTING.PUBLISH,
        ...(dateRange ? { createdAt: dateRange } : {})
      });

      const averageDurationAgg = await Model.Classes.aggregate([
        {
          $match: {
            isDeleted: false,
            setting: constants.SETTING.PUBLISH,
            duration: { $ne: null },
            ...(dateRange ? { createdAt: dateRange } : {})
          }
        },{
          $group: {
            _id: null,
            averageDuration: { $avg: "$duration" }
          }
        },{
          $project: {
            _id: 0,
            averageDuration: 1
          }
        }
      ]);
      const averageDuration = averageDurationAgg[0]?.averageDuration || 0;

      let onlineClasses = await Model.Classes.countDocuments({ 
        isDeleted: false,
        setting: constants.SETTING.PUBLISH,
        classMode: constants.CLASS_MODE.ONLINE,
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      let offlineClasses = await Model.Classes.countDocuments({ 
        isDeleted: false,
        setting: constants.SETTING.PUBLISH,
        classMode: constants.CLASS_MODE.OFFLINE,
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      let hybridClasses = await Model.Classes.countDocuments({ 
        isDeleted: false,
        setting: constants.SETTING.PUBLISH,
        classMode: constants.CLASS_MODE.HYBRID,
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      data = {
        activeStudents,
        totalClasses,
        averageDuration,
        onlineClasses,
        offlineClasses,
        hybridClasses
      };
    }else if(req.query.dashboardType == constants.DASHBOARD_TYPE.CONTENT){
      let contentUploaded = await Model.Content.countDocuments({
        setting: constants.SETTING.PUBLISH,
        isDeleted: false,
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      let totalLikes = await Model.Engagement.countDocuments({
        engagementType: constants.ENGAGEMENTS.LIKE,
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      let comments = await Model.Comment.countDocuments({
        ...(dateRange ? { createdAt: dateRange } : {})
      });
      const giftTipsAgg = await Model.Content.aggregate([
        {
          $match: {
            setting: constants.SETTING.PUBLISH,
            ...(dateRange ? { createdAt: dateRange } : {}),
            isDeleted: false
          }
        },{
          $group: {
            _id: null,
            totalGiftsEarned: { $sum: "$giftsEarn" }
          }
        },{
          $project: {
            _id: 0,
            totalGiftsEarned: 1
          }
        }
      ]);
      const giftTips = giftTipsAgg[0]?.totalGiftsEarned || 0;

      let teaserCount = await Model.Content.countDocuments({
        contentType: constants.CONTENT_TYPE.TEASER_VIDEO,
        setting: constants.SETTING.PUBLISH,
        ...(dateRange ? { createdAt: dateRange } : {}),
        isDeleted: false
      });

      let shortVideoCount = await Model.Content.countDocuments({
        contentType: constants.CONTENT_TYPE.SHORT_VIDEO,
        setting: constants.SETTING.PUBLISH,
        ...(dateRange ? { createdAt: dateRange } : {}),
        isDeleted: false
      });

      let forumCount = await Model.Content.countDocuments({
        contentType: constants.CONTENT_TYPE.SHORT_VIDEO,
        setting: constants.SETTING.PUBLISH,
        ...(dateRange ? { createdAt: dateRange } : {}),
        isDeleted: false
      });

      let postCount = await Model.Content.countDocuments({
        contentType: constants.CONTENT_TYPE.POST,
        setting: constants.SETTING.PUBLISH,
        ...(dateRange ? { createdAt: dateRange } : {}),
        isDeleted: false
      });

      const avgViewsAgg = await Model.Content.aggregate([
        {
          $match: {
            views: { $ne: 0 },
            ...(dateRange ? { createdAt: dateRange } : {})
          }
        },{
          $group: {
            _id: null,
            avgViews: { $avg: "$views" }
          }
        },{
          $project: {
            _id: 0,
            avgViews: 1
          }
        }
      ]);
      const avgViews = avgViewsAgg[0]?.avgViews || 0;

     const engagementRateAgg = await Model.Content.aggregate([
      {
        $match: {
          views: { $gt: 0 },
          isDeleted: false,
          setting: constants.SETTING.PUBLISH,
          ...(dateRange ? { createdAt: dateRange } : {})
        }
      },{
        $lookup: {
          from: "engagements",
          localField: "_id",
          foreignField: "contentId",
          as: "engagements"
        }
      },{
        $project: {
          uniqueEngagedUsers: {
            $size: {
              $setUnion: [{
                $map: {
                  input: "$engagements",
                  as: "e",
                  in: "$$e.userId"
                }
              },
            []
          ]}
        },
        views: 1
       }
      },{
        $group: {
          _id: null,
          totalUniqueUsersEngaged: { $sum: "$uniqueEngagedUsers" },
          totalViews: { $sum: "$views" }
        }
      },{
        $project: {
          _id: 0,
          engagementRate: {
            $cond: [
              { $gt: ["$totalViews", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalUniqueUsersEngaged", "$totalViews"] }, 100] }, 2] },
              0
            ]
          }
        }
      }
    ]);
      const engagementRate = engagementRateAgg[0]?.engagementRate || 0;
      data = {
        contentUploaded,
        totalLikes,
        comments,
        giftTips,
        teaserCount,
        shortVideoCount,
        forumCount,
        postCount,
        avgViews,
        engagementRate
      };
     
    }
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, data);
  } catch (error) {
    next(error);
  }
};
module.exports.earningGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
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
    let Brr;

    if (req.query.type === "daily") {
      let D1 = 0,
        D2 = 0,
        D3 = 0,
        D4 = 0,
        D5 = 0,
        D6 = 0,
        D7 = 0;
      earning = await Model.Booking.aggregate([{
          $match: {
            isDeleted: false,
            bookingStatus: constants.BOOKING_STATUS.COMPLETED
          }
        },{
          $match: {
            createdAt: {
              $gte: StartofWeek,
              $lte: EndofWeek
            }
          }
        },
        {
          $match: qry
        }
      ]);
      earning.map((val) => {
        let day = moment(val.createdAt).format("dd");
        // eslint-disable-next-line default-case
        switch (day) {
          case "Mo":
            D1 = D1 + val.grandTotal;
            break;
          case "Tu":
            D2 = D2 + val.grandTotal;
            break;
          case "We":
            D3 = D3 + val.grandTotal;
            break;
          case "Th":
            D4 = D4 + val.grandTotal;
            break;
          case "Fr":
            D5 = D5 + val.grandTotal;
            break;
          case "Sa":
            D6 = D6 + val.grandTotal;
            break;
          case "Su":
            D7 = D7 + val.grandTotal;
            break;
        }
      });
      let Brr = [D1, D2, D3, D4, D5, D6, D7];
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
      earning = await Model.Booking.aggregate([{
          $match: {
            isDeleted: false,
            bookingStatus: constants.BOOKING_STATUS.COMPLETED
          }
        },
        {
          $match: {
            createdAt: {
              $gte: startOFMonth,
              $lte: endOFMonth
            }
          }
        },
        {
          $match: qry
        }
      ]);
      earning.map((val) => {
        let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
        // eslint-disable-next-line default-case
        switch (week) {
          case 1:
            W1 = W1 + val.grandTotal;
            break;
          case 2:
            W2 = W2 + val.grandTotal;
            break;
          case 3:
            W3 = W3 + val.grandTotal;
            break;
          case 4:
            W4 = W4 + val.grandTotal;
            break;
          case 5:
            W5 = W5 + val.grandTotal;
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

      earning = await Model.Booking.aggregate([{
          $match: {
            isDeleted: false,
            bookingStatus: constants.BOOKING_STATUS.COMPLETED
          }
        },
        {
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
            M1 = M1 + val.grandTotal;
            break;
          case 2:
            M2 = M2 + val.grandTotal;
            break;
          case 3:
            M3 = M3 + val.grandTotal;
            break;
          case 4:
            M4 = M4 + val.grandTotal;
            break;
          case 5:
            M5 = M5 + val.grandTotal;
            break;
          case 6:
            M6 = M6 + val.grandTotal;
            break;
          case 7:
            M7 = M7 + val.grandTotal;
            break;
          case 8:
            M8 = M8 + val.grandTotal;
            break;
          case 9:
            M9 = M9 + val.grandTotal;
            break;
          case 10:
            M10 = M10 + val.grandTotal;
            break;
          case 11:
            M11 = M11 + val.grandTotal;
            break;
          case 12:
            M12 = M12 + val.grandTotal;
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
      earning = await Model.Booking.aggregate([{
          $match: {
            isDeleted: false,
            bookingStatus: constants.BOOKING_STATUS.COMPLETED
          }
        },
        {
          $addFields: {
            year: {
              $year: "$createdAt"
            }
          }
        },
        {
          $group: {
            _id: "$year",
            total: {
              $sum: "$grandTotal"
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
    const csvData = await jsonexport(Brr);
    if (req.query.export == "csv") {
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
      });
      const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'earningGraph.csv',
        Body: csvData
      };

      s3.upload(params, (err, data) => {
        if (err) {
          console.error(err);
          return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
        }
        console.log('File uploaded successfully', data.Location);
        res.success({
          message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
          s3Location: data.Location
        });
      });
    } else
      return res.send({
        statusCode: 200,
        message: constants.MESSAGES[lang].DATA_FETCHED,
        data: Brr
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
};

//User - parent
module.exports. addParent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.addUser.validateAsync(req.body);
    if (req.body.phoneNo) {
      let checkPhone = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isPhoneVerified: true,
        isDeleted: false
      }, {
        password: 0
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
        isDeleted: false
      }, {
        password: 0
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
    let addUser = await Model.User.create(req.body);
    return res.success(constants.MESSAGES[lang].USER_CREATED_SUCCESSFULLY, addUser);
  } catch (error) {
    next(error);
  }
};
module.exports.getParent = async (req, res, next) => {
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

      qry.role = constants.APP_ROLE.PARENT;
      let pipeline = [{
          $addFields: {
            _search: {
              $concat: [{
                $ifNull: ["$name", ""]
              }, {
                $ifNull: ["$email", ""]
              }, {
                $ifNull: ["$phoneNo", ""]
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

      if (req.query.delete === 'true') {
        qry.isDeleted = true;
        pipeline.push({
          $sort: {
            updatedAt: -1
          }
        });
      } else if (req.query.delete === 'false') {
        qry.isDeleted = false;
      }

      pipeline = await common.pagination(pipeline, skip, limit);
      let [parent] = await Model.User.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        parent: parent.data,
        totalParent: parent.total
      });
    } else {
      let pipeline = [{
        $match: {
          _id: ObjectId(id)
        }
      }];
      let [parent] = await Model.User.aggregate(pipeline);
      parent = parent ? parent : null;
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, parent);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.updateParent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.updateUser.validateAsync(req.body);
    if (req.body.phoneNo) {
      let checkPhone = await Model.User.findOne({
        _id: {
          $nin: [ObjectId(req.params.id)]
        },
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isPhoneVerified: true,
        isDeleted: false
      });
      if (checkPhone) {
        throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
      }
    }
    if (req.body.email) {
      let checkEmail = await Model.User.findOne({
        _id: {
          $nin: [ObjectId(req.params.id)]
        },
        email: req.body.email.toLowerCase(),
        isDeleted: false
      });
      if (checkEmail) {
        throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
      }
    }
    const doc = await Model.User.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    }, {
      $set: req.body
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].PROFILE_UPDATED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteParent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const doc = await Model.User.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    }, {
      $set: {
        isDeleted: true,
        deletedAt: new Date()
      }
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].PROFILE_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};
module.exports.parentExport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const data = await Model.User.find({
      isDeleted: false
    }).sort({
      createdAt: -1
    });
    console.log(data);
    const user = [];
    data.map((item) => {
      user.push({
        name: item.name,
        dialCode: item.dialCode,
        phoneNo: item.phoneNo,
        email: item.email,
        isBlocked: item.isBlocked
      });
    });
    const csvData = await jsonexport(user);

    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'parent.csv',
      Body: csvData
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        throw new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
      }
      console.log('File uploaded successfully', data.Location);
      res.success({
        message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
        s3Location: data.Location
      });
    });

  } catch (error) {
    next(error);
  }
};

//Parent Booking
module.exports.parentBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let qry = {};

    if (req.query.bookingType === "activity") {
      qry.bookingStatus = {
        $in: [
          constants.BOOKING_STATUS.PENDING,
          constants.BOOKING_STATUS.ACCEPTED,
          constants.BOOKING_STATUS.ONGOING,
          constants.BOOKING_STATUS.REJECTED,
          constants.BOOKING_STATUS.CANCELLED,
          constants.BOOKING_STATUS.COMPLETED
        ]
      };
    } else if (req.query.bookingType === "purchase") {
      qry.bookingStatus = {
        $in: [constants.BOOKING_STATUS.COMPLETED]
      };
    }

    let pipeline = [{
        $match: {
          parentId: ObjectId(req.params.id),
          isDeleted: false
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
      }];

    pipeline = await common.pagination(pipeline, skip, limit);

    let [booking] = await Model.Booking.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      booking: booking.data,
      totalBooking: booking.total
    });

  } catch (error) {
    next(error);
  }
};

//User - tutor
module.exports.addTutor = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.addUser.validateAsync(req.body);
    if (req.body.phoneNo) {
      let checkPhone = await Model.User.findOne({
        dialCode: req.body.dialCode,
        phoneNo: req.body.phoneNo,
        isDeleted: false
      }, {
        password: 0
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
        isDeleted: false
      }, {
        password: 0
      });
      if (checkEmail) {
        throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
      } else {
        await Model.User.deleteMany({
          email: req.body.email.toLowerCase(),
          isEmailVerified: false,
          isPhoneVerified: false,
          isDeleted: false
        });
      }
    }
    req.body.documentVerification = true;
    req.body.profileCompletedAt = constants.PROFILE_STATUS.PROFILE_SETUP;
    req.body.tutorStatus = constants.TUTOR_STATUS.ACCEPTED;
    req.body.isEmailVerified = true;
    req.body.isPhoneVerified = true;
    let addUser = await Model.User.create(req.body);
    return res.success(constants.MESSAGES[lang].USER_CREATED_SUCCESSFULLY, addUser);
  } catch (error) {
    next(error);
  }
};
module.exports.getTutor = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const id = req.params.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    let baseMatch = { role: constants.APP_ROLE.TUTOR };
    baseMatch.isDeleted = req.query.delete === "true" ? true : false;

    if (req.query.tutorStatus) {
      baseMatch.tutorStatus = Number(req.query.tutorStatus);
    }

    if (!id && !req.query.currTutor) {
      let pipeline = [{
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
          $match: {
            ...baseMatch,
            ...(req.query.categoryId && {
              "teachingdetails.categoryId": ObjectId(req.query.categoryId)
            }),
            ...(req.query.subjectId && {
              "teachingdetails.subjectIds": ObjectId(req.query.subjectId)
            }),
            ...(req.query.search && {
              $or: [
                { name: { $regex: req.query.search, $options: "i" } },
                { email: { $regex: req.query.search, $options: "i" } },
                { phoneNo: { $regex: req.query.search, $options: "i" } },
                { userName: { $regex: req.query.search, $options: "i" } }
              ]
            })
          }
        },{
          $sort: {
            [req.query.delete === "true" ? "updatedAt" : "createdAt"]: -1
          }
        }];
        const onlineCountPipeline = [
          {
            $match: {
              ...baseMatch,
              isActive: true
            }
          },
          {
            $count: "onlineTutors"
          }
        ];

      pipeline = await common.pagination(pipeline, skip, limit);
      const [tutor] = await Model.User.aggregate(pipeline);
      const onlineCount = await Model.User.aggregate(onlineCountPipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        tutor: tutor?.data || [],
        totalTutor: tutor?.total || 0,
        onlineTutor: onlineCount?.[0]?.onlineTutors || 0
      });
    } else {
      let pipeline = [];
      if (req.query.currTutor) {
        const lastTutor = await Model.User.findOne(
          { _id: req.query.currTutor, isDeleted: false },
          { createdAt: 1 }
        );

        pipeline.push({
            $match: {
              isDeleted: false,
              createdAt: { $gt: new Date(lastTutor.createdAt) }
            }
          },
          { $limit: 1 }
        );
      } else {
        pipeline.push({
          $match: { _id: ObjectId(id), isDeleted: false }
        });
      }

      pipeline.push({
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
          $sort: {
            createdAt: -1
          }
        },{
          $project: {
            name: 1,
            email: 1,
            dialCode: 1,
            phoneNo: 1,
            age: 1,
            gender: 1,
            image: 1,
            userName: 1,
            address: 1,
            shortBio: 1,
            tutorStatus: 1,
            latitude: 1,
            longitude: 1,
            teachingdetails: 1
          }
        });
      const [tutor] = await Model.User.aggregate(pipeline);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor || null);
    }
  } catch (error) {
    next(error);
  }
};

module.exports.updateTutor = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.updateUser.validateAsync(req.body);

    const ids = req.body.ids || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("No IDs provided");
    }

    if (req.body.status === 'tutorUpdate') {
      if (req.body.phoneNo) {
        const checkPhone = await Model.User.findOne({
          _id: { $nin: ids.map(id => ObjectId(id)) },
          dialCode: req.body.dialCode,
          phoneNo: req.body.phoneNo,
          isPhoneVerified: true,
          isDeleted: false
        });
        if (checkPhone) {
          throw new Error(constants.MESSAGES[lang].PHONE_ALREADY_IN_USE);
        }
      }
      if (req.body.email) {
        const checkEmail = await Model.User.findOne({
          _id: { $nin: ids.map(id => ObjectId(id)) },
          email: req.body.email.toLowerCase(),
          isDeleted: false
        });
        if (checkEmail) {
          throw new Error(constants.MESSAGES[lang].EMAIL_ALREADY_IN_USE);
        }
      }
    }

    let update = {};
    let tutorPushType = null;

    switch (req.body.status) {
      case "accept":
        update = {
          $set: {
            tutorStatus: constants.TUTOR_STATUS.ACCEPTED,
            tutorAcceptedAt: new Date()
          }
        };
        tutorPushType = constants.PUSH_TYPE_KEYS.TUTOR_ACCEPTED;
        break;

      case "reject":
        update = {
          $set: {
            tutorStatus: constants.TUTOR_STATUS.REJECTED,
            tutorRejectedAt: new Date(),
            rejectReason: req.body.rejectReason || ""
          }
        };
        tutorPushType = constants.PUSH_TYPE_KEYS.TUTOR_REJECTED;
        break;

      case "delete":
        update = {
          $set: {
            isDeleted: true,
            deletedAt: new Date()
          }
        };
        break;

      case "tutorUpdate":
        update = { $set: req.body };
        break;

      default:
        throw new Error("Invalid status");
    }

    await Model.User.updateMany(
      { _id: { $in: ids.map(id => ObjectId(id)) }, isDeleted: false },
      update
    );

    const updatedTutors = await Model.User.find({ _id: { $in: ids.map(id => ObjectId(id)) } });

    for (const tutor of updatedTutors) {
      if (req.body.status === "accept") {
        const payload = {
          title: "Tutor Accepted",
          name: tutor.name,
          email: tutor.email
        };
        await services.EmalService.tutorAcceptEmail(payload);
      }

      if (req.body.status === "reject") {
        const payload = {
          title: "Tutor Rejected",
          name: tutor.name,
          email: tutor.email,
          reason: req.body.rejectReason || ""
        };
        await services.EmalService.tutorRejectEmail(payload);
      }

      if (tutorPushType) {
        process.emit("sendNotification", {
          tutorId: tutor._id,
          receiverId: tutor._id,
          values: tutor,
          role: constants.ROLE.TUTOR,
          isNotificationSave: true,
          pushType: tutorPushType
        });
      }
    }

    return res.success(constants.MESSAGES[lang].PROFILE_UPDATED_SUCCESSFULLY, {});
  } catch (error) {
    next(error);
  }
};
module.exports.deleteTutor = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const findBooking = await Model.Booking.findOne({
      tutorId: ObjectId(req.params.id),
      isDeleted: false,
      bookingStatus: {
        $in: [constants.BOOKING_STATUS.ACCEPTED, constants.BOOKING_STATUS.ONGOING]
      }
    });
    if (findBooking) {
      throw new Error(constants.MESSAGES[lang].TUTOR_BOOKING_EXIST);
    }
    const doc = await Model.User.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    }, {
      $set: {
        isDeleted: true,
        deletedAt: new Date()
      }
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].PROFILE_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};
module.exports.tutorExport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const user = [];
    let qry = {};

    if (req.query.tutorStatus) {
      qry.tutorStatus = Number(req.query.tutorStatus);
    }

    let pipeline = [{
        $match: {
          isDeleted: false
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
          from: "categories",
          localField: "teachingdetails.categoryId",
          foreignField: "_id",
          as: "categories"
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "teachingdetails.subjectIds",
          foreignField: "_id",
          as: "subjectIds"
        }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      }];

    let data = await Model.User.aggregate(pipeline);

    function getLabelsFromEnum(enumObj, values) {
      if (!Array.isArray(values)) return [];
      return values.map(val => {
        const entry = Object.entries(enumObj).find(([k, v]) => v === val);
        return entry ? entry[0].replace(/_/g, " ") : val;
      });
    }

    for (const item of data) {
      const teachingStyles = getLabelsFromEnum(
        constants.TEACHING_STYLE,
        item.teachingdetails?.teachingStyle
      );

      const curriculums = getLabelsFromEnum(
        constants.CURRICULUM,
        item.teachingdetails?.curriculum
      );

      const categories = Array.isArray(item.categories)
        ? item.categories.map(c => c.name).join(", ")
        : "";

      const subjects = Array.isArray(item.subjectIds)
        ? item.subjectIds.map(s => s.name).join(", ")
        : "";

      const grades = getLabelsFromEnum(
        constants.GRADE_TYPE,
        item.teachingdetails?.classes
      );
      const teachingLanguage = (() => {
        const entry = Object.entries(constants.TEACHING_LANGUAGE)
        .find(([k, v]) => v === item.teachingdetails?.teachingLanguage);
        return entry ? entry[0].replace(/_/g, " ") : "";
      })();

      const higherEdu = (() => {
        const entry = Object.entries(constants.EDU_DOC)
        .find(([k, v]) => v === item.teachingdetails?.higherEdu);
        return entry ? entry[0].replace(/_/g, " ") : "";
      })();
      
      user.push({
        Name: item.name,
        UserName: item.userName,
        DialCode: item.dialCode,
        PhoneNo: item.phoneNo,
        Email: item.email,
        AccountStatus: item.isBlocked ? "Yes" : "No",
        TeachingExperience: item.teachingdetails?.totalTeachingExperience || "",
        TeachingStyle: teachingStyles.join(", "),
        Curriculum: curriculums.join(", "),
        Category: categories,
        Subjects: subjects,
        Grades: grades.join(", "),
        TeachingLanguage: teachingLanguage,
        Price: item.teachingdetails?.price || "",
        Currency: item.teachingdetails?.country || "",
        Specialization: item.teachingdetails?.specialization || "",
        Achievement: item.teachingdetails?.achievement || "",
        HigherEducation: higherEdu
      });
    }
    const csvData = await jsonexport(user);
    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: "tutor.csv",
      Body: csvData
    };
    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
      }
      console.log("File uploaded successfully", data.Location);
      res.success({
        message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
        s3Location: data.Location
      });
    });

  } catch (error) {
    next(error);
  }
};

//Teaching-Details
module.exports.teachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let classDoc, subDoc, teachDoc;
    let upTeachDoc, upSubDoc, upClassDoc;

    await Validation.Admin.addTeachingDetails.validateAsync(req.body);

    const tutorData = await Model.User.findOne({
      _id: ObjectId(req.body.tutorId),
      isDeleted: false
    });
    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const existingDetail = await Model.TeachingDetails.findOne({
      tutorId: tutorData._id,
      isDeleted: false
    });

    if (existingDetail) {
      upTeachDoc = await Model.TeachingDetails.findOneAndUpdate({
        tutorId: existingDetail.tutorId,
        isDeleted: false
      }, {
        $set: req.body
      }, {
        new: true
      });
    } else {
      teachDoc = await Model.TeachingDetails.create(req.body);
    }

    await Model.User.findOneAndUpdate({
      _id: ObjectId(req.body.tutorId),
      isDeleted: false
    }, {
      $set: {
        profileCompletedAt: constants.PROFILE_STATUS.TEACHING_DETAIL
      }
    }, {
      new: true
    });

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
module.exports.getTeachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          tutorId: ObjectId(req.params.id),
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
module.exports.deleteTeachingDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const doc = await Model.TeachingDetails.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    }, {
      isDeleted: true
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].PROFILE_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

//Bank Details
module.exports.addBankDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.addBankDetails.validateAsync(req.body);
    const tutorData = await Model.User.findOne({
      _id: ObjectId(req.body.tutorId),
      isDeleted: false
    });
    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    
    let addBankDetails = await Model.BankDetails.create(req.body);

    await Model.User.findOneAndUpdate({
      _id: ObjectId(req.body.tutorId),
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
module.exports.getBankDetails = async (req, res, next) => {
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
          tutorId: ObjectId(id),
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
module.exports.updateBankDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.updateBankDetails.validateAsync(req.body);
    const tutorData = await Model.User.findOne({
      _id: ObjectId(req.body.tutorId),
      isDeleted: false
    });

    const existingDetail = await Model.BankDetails.findOne({
      tutorId: tutorData._id,
      isDeleted: false
    });

    let bankDetail;

    if (existingDetail) {
      bankDetail = await Model.BankDetails.findOneAndUpdate({
        tutorId: existingDetail.tutorId,
        isDeleted: false
      }, {
        $set: req.body
      }, {
        new: true
      });
    } else {
      bankDetail = await Model.BankDetails.create(req.body);
    }
    return res.success(
      constants.MESSAGES[lang].BANk_DETAILS_UPDATED_SUCCESSFULLY,
      bankDetail
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deleteBankDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const bankData = await Model.BankDetails.findOne({
      tutorId: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!bankData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }
    const doc = await Model.BankDetails.findOneAndUpdate({
      tutorId: ObjectId(req.params.id)
    }, {
      isDeleted: true
    }, {
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

//Documents
module.exports.addDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Tutor.addDocuments.validateAsync(req.body);

    let tutorId = req.body.tutorId;
    let tutorData = await Model.User.findOne({
      _id: tutorId,
      isDeleted: false
    });

    if (!tutorData) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }

    let documents = req.body.documents;
    let create = [];

    for (let i = 0; i < documents.length; i++) {
      let currentDocument = documents[i];
      if (currentDocument._id) {
        let docId = currentDocument._id;
        delete currentDocument._id;
        let updatedDoc = await Model.RequiredDocuments.findOneAndUpdate({
          _id: ObjectId(docId),
          tutorId: ObjectId(currentDocument.tutorId),
          isDeleted: false
        }, {
          $set: currentDocument
        }, {
          new: true
        });
        create.push(updatedDoc);
      } else {
        let profile;
        if (currentDocument.documentType == constants.DOCUMENT_TYPE.ACHIEVEMENTS) {
          profile = constants.PROFILE_STATUS.ACHIEVEMENT;
        }
        if (currentDocument.documentType == constants.DOCUMENT_TYPE.CERTIFICATES) {
          profile = constants.PROFILE_STATUS.CERTIFICATES;
        }

        if (currentDocument.documentType == constants.DOCUMENT_TYPE.VERIFICATION_DOCS) {
          profile = constants.PROFILE_STATUS.DOCUMENT;
        }
        currentDocument.tutorId = tutorId;
        let result = await Model.RequiredDocuments.create(currentDocument);
        create.push(result);

        await Model.User.findOneAndUpdate({
          _id: ObjectId(req.body.tutorId),
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
    
    return res.success(constants.MESSAGES[lang].DOCUMENT_CREATED_SUCCESSFULLY, create);
  } catch (error) {
    next(error);
  }
};
module.exports.getDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let id = req.params.id;

    let qry = {};
    if (req.query.documentType) {
      qry.documentType = Number(req.query.documentType);
    }
    if (req.query.status) {
      qry.status = Number(req.query.status);
    }
    let pipeline = [{
        $match: {
          tutorId: ObjectId(id),
          isDeleted: false
        }
      },{
        $match: qry
      }];
    let document = await Model.RequiredDocuments.aggregate(pipeline);
    
    // Handle existing documents without status field
    document = document.map(doc => ({
      ...doc,
      status: doc.status || constants.DOCUMENT_STATUS.PENDING,
      rejectionReason: doc.rejectionReason || ""
    }));
    
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, document);
  } catch (error) {
    next(error);
  }
};
module.exports.updateDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    req.query.apiType = "add";
    let isAccess = await subAdmin.checkSubAdmin(req);
    if (isAccess) {
      await Validation.Admin.updateDocuments.validateAsync(req.body);

      const doc = await Model.RequiredDocuments.findOneAndUpdate({
        _id : ObjectId(req.params.id),
        isDeleted: false
      }, {
        $set: req.body
      }, {
        new: true
      });
      return res.success(constants.MESSAGES[lang].DOCUMENT_UPDATED_SUCCESSFULLY, doc);
    }
    throw new Error(constants.MESSAGES[lang].ACCESS_DENIED);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteDocuments = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const doc = await Model.RequiredDocuments.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    }, {
      isDeleted: true
    }, {
      new: true
    });

    return res.success(constants.MESSAGES[lang].DOCUMENT_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

module.exports.approveDocument = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    
    const doc = await Model.RequiredDocuments.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      isDeleted: false
    }, {
      $set: {
        status: constants.DOCUMENT_STATUS.VERIFIED,
        rejectionReason: ""
      }
    }, {
      new: true
    }).populate('tutorId', 'name email');

    if (!doc) {
      throw new Error(constants.MESSAGES[lang].DOCUMENT_NOT_FOUND);
    }

    // Send approval email to tutor
    if (doc.tutorId && doc.tutorId.email) {
      try {
        const DocumentEmailService = require('../../../services/DocumentEmailService');
        await DocumentEmailService.documentApproved({
          email: doc.tutorId.email,
          tutorName: doc.tutorId.name,
          documentType: getDocumentTypeName(doc.documentType),
          description: doc.description || 'N/A',
          approvedDate: new Date().toLocaleDateString()
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the API if email fails
      }
    }

    return res.success(constants.MESSAGES[lang].DOCUMENT_APPROVED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

module.exports.rejectDocument = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    
    await Validation.Admin.rejectDocument.validateAsync(req.body);
    
    const doc = await Model.RequiredDocuments.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      isDeleted: false
    }, {
      $set: {
        status: constants.DOCUMENT_STATUS.REJECTED,
        rejectionReason: req.body.rejectionReason || ""
      }
    }, {
      new: true
    }).populate('tutorId', 'name email');

    if (!doc) {
      throw new Error(constants.MESSAGES[lang].DOCUMENT_NOT_FOUND);
    }

    // Send rejection email to tutor
    if (doc.tutorId && doc.tutorId.email) {
      try {
        const DocumentEmailService = require('../../../services/DocumentEmailService');
        await DocumentEmailService.documentRejected({
          email: doc.tutorId.email,
          tutorName: doc.tutorId.name,
          documentType: getDocumentTypeName(doc.documentType),
          description: doc.description || 'N/A',
          rejectedDate: new Date().toLocaleDateString(),
          rejectionReason: doc.rejectionReason
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the API if email fails
      }
    }

    return res.success(constants.MESSAGES[lang].DOCUMENT_REJECTED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

module.exports.requestDocument = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    
    await Validation.Admin.requestDocument.validateAsync(req.body);
    
    const tutor = await Model.User.findOne({
      _id: ObjectId(req.body.tutorId),
      isDeleted: false,
      role: constants.APP_ROLE.TUTOR
    });

    if (!tutor) {
      throw new Error(constants.MESSAGES[lang].USER_DATA_MISSING);
    }

    if (!tutor.email) {
      throw new Error(constants.MESSAGES[lang].EMAIL_MISSING);
    }

    // Send document request email to tutor
    try {
      const DocumentEmailService = require('../../../services/DocumentEmailService');
      await DocumentEmailService.documentRequested({
        email: tutor.email,
        tutorName: tutor.name,
        requestMessage: req.body.requestMessage
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      throw new Error(constants.MESSAGES[lang].EMAIL_SENDING_FAILED || 'Failed to send email');
    }

    return res.success(constants.MESSAGES[lang].DOCUMENT_REQUEST_SENT_SUCCESSFULLY || 'Document request sent successfully', {
      tutorId: tutor._id,
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      requestMessage: req.body.requestMessage,
      requestedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
};

//Tutor Details
module.exports.getTutorDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let id = req.params.id;

    let pipeline = [{
        $match: {
          _id: ObjectId(id)
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
          from: "categories",
          localField: "teachingdetails.categoryId",
          foreignField: "_id",
          as: "categories"
        }
      },{
        $lookup: {
          from: "subjects",
          localField: "teachingdetails.subjectIds",
          foreignField: "_id",
          as: "subjectIds"
        }
      },{
        $lookup: {
          from: "bankdetails",
          localField: "_id",
          foreignField: "tutorId",
          as: "bankdetails"
        }
      },{
        $unwind: {
          path: "$bankdetails",
          preserveNullAndEmptyArrays: true
        }
      },{
        $lookup: {
          from: "requireddocuments",
          localField: "_id",
          foreignField: "tutorId",
          as: "documents"
        }
      }];

    let tutor = await Model.User.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);
  } catch (error) {
    next(error);
  }
};

//Tutor - Review
module.exports.tutorReview = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let qry = {};

    let pipeline = [{
        $match: {
          isDeleted: false,
          tutorId: ObjectId(req.params.id)
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
        }
      },{
        $addFields: {
          avgRating: {
            $avg: "$rating"
          }
        }
      },{
        $project: {
          "parents.name": 1,
          avgRating: 1
        }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [rating] = await Model.Rating.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      rating: rating.data,
      totalRating: rating.total
    });

  } catch (error) {
    next(error);
  }
};

//Tutor - activity history
module.exports.activityHistory = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let qry = {};

    if (req.query.bookingType === "activity") {
      qry.bookingStatus = {
        $in: [
          constants.BOOKING_STATUS.PENDING,
          constants.BOOKING_STATUS.ACCEPTED,
          constants.BOOKING_STATUS.ONGOING,
          constants.BOOKING_STATUS.REJECTED,
          constants.BOOKING_STATUS.CANCELLED,
          constants.BOOKING_STATUS.COMPLETED
        ]
      };
    } else if (req.query.bookingType === "purchase") {
      qry.bookingStatus = {
        $in: [constants.BOOKING_STATUS.COMPLETED]
      };
    }

    let pipeline = [{
        $match: {
          tutorId: ObjectId(req.params.id),
          isDeleted: false
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
          preserveNullAndEmptyArrays: true
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
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [booking] = await Model.Booking.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      booking: booking.data,
      totalBooking: booking.total
    });

  } catch (error) {
    next(error);
  }
};

//Tutor - earning
module.exports.tutorEarning = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let tutor = await Model.User.findById(req.params.id);
    let totalEarning = tutor.totalEarn;
    let withdrawAmount = tutor.withdrawAmount;
    let balance = tutor.balance;

    let pipeline = [{
        $match: {
          tutorId: ObjectId(req.params.id),
          isDeleted: false
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
        $project: {
          bookingNumber: 1,
          "parents.name": 1,
          withDrawStatus: 1,
          createdAt: 1,
          grandTotal: 1
        }
      },{
        $sort: {
          createdAt: -1
        }
      }];
    pipeline = await common.pagination(pipeline, skip, limit);
    let [booking] = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].Data_FETCHED, {
      totalEarning,
      withdrawAmount,
      balance,
      booking
    });
  } catch (error) {
    next(error);
  }
};
module.exports.withdrawStatus = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.updateWithdrawStatus.validateAsync(req.body);
    let withdrawRequest;
    let ids = [];
    ids = req.body.ids;
    let message;
    for (let id of ids) {
      if (req.body.status == "accept") {
        withdrawRequest  = await Model.TutorWithdraw.findOneAndUpdate({
          _id: ObjectId(id),
          withdrawStatus: constants.WITHDRAW_STATUS.PENDING,
          isDeleted: false
        },{
          $set: {
            withdrawStatus: constants.WITHDRAW_STATUS.ACCEPTED
          }
        },{
          new: true
        });
        await Model.User.findByIdAndUpdate(withdrawRequest.tutorId, {
          $inc: {
            withdrawAmount: withdrawRequest.withdraw, 
            balance: -withdrawRequest.withdraw       
          }
        });
        message = constants.MESSAGES[lang].WITHDRAW_STATUS_UPDATED_SUCCESSFULLY;
      }
      if (req.body.status == 'reject') {
        withdrawRequest = await Model.TutorWithdraw.findOneAndUpdate({
          _id: ObjectId(id),
          withdrawStatus: constants.WITHDRAW_STATUS.PENDING,
          isDeleted: false
        },{
          $set: {
            withdrawStatus: constants.WITHDRAW_STATUS.REJECTED
          }
        },{
          new: true
        });
        message = constants.MESSAGES[lang].WITHDRAW_STATUS_UPDATED_SUCCESSFULLY;
      }

      if (req.body.status == 'delete') {
        withdrawRequest = await Model.TutorWithdraw.findOneAndUpdate({
          _id: ObjectId(id),
          isDeleted: false
        },{
          $set: {
            isDeleted: true
          }
        },{
          new: true
        });
        message = constants.MESSAGES[lang].WITHDRAW_REQUEST_DELETED_SUCCESSFULLY;
      }
    }
    let withdrawPushType;
      switch (withdrawRequest.withdrawStatus) {
        case constants.WITHDRAW_STATUS.ACCEPTED:
          withdrawPushType = constants.PUSH_TYPE_KEYS.WITHDRAW_ACCEPTED;
          break;
        case constants.WITHDRAW_STATUS.REJECTED:
          withdrawPushType = constants.PUSH_TYPE_KEYS.WITHDRAW_REJECTED;
          break;
        default:
          break;
      }
      process.emit("sendNotification", {
        tutorId: withdrawRequest.tutorId,
        receiverId: withdrawRequest.tutorId,
        values: withdrawRequest,
        role: constants.ROLE.TUTOR,
        isNotificationSave: true,
        pushType: withdrawPushType
      });
    return res.success(message, withdrawRequest);
  } catch (error) {
    next(error);
  }
};
module.exports.tutorPayment = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    
    let qry = {};
    if(req.query.status){
      qry.withdrawStatus = Number(req.query.status);
    }

    let pipeline = [{
      $match: {
        isDeleted: false,
        ...qry
      }
    },{
        $lookup: {
            from: "users",
            localField: "tutorId",
            foreignField: "_id",
            as: "tutorId"
          }
      },{
          $unwind: {
            path: "$tutorId",
            preserveNullAndEmptyArrays: false
          }
      },{
        "$project": {
          "tutorId._id": 1,
          "tutorId.name": 1,
          "tutorId.phoneNo": 1,
          "tutorId.email": 1,
          "tutorId.withdrawAmount": 1,
          "tutorId.balance": 1,
          withdraw: 1,
          withdrawMode: 1,
          createdAt: 1
        }
      }];
    pipeline = await common.pagination(pipeline, skip, limit);
    let [payment] = await Model.TutorWithdraw.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].Data_FETCHED, payment);
  } catch (error) {
    next(error);
  }
};

//Booking
module.exports.getBooking = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;
    if (req.params.id == null) {
      let qry = {};

      if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "parents.name": searchRegex
        },{
          "parents.email": searchRegex
        },{
          "tutors.name": searchRegex
        },{
          bookingNumber: searchRegex
        },{
          "tutors.email": searchRegex
        }];
      }

      if (req.query.isOnline === 'true') {
        qry.classModeOnline = true;
      } else if (req.query.isOnline === 'false') {
        qry.classModeOnline = false;
      }

      if (req.query.bookingType == constants.BOOKING_STATUS.ONGOING) {
        qry.bookingStatus = { $in: [constants.BOOKING_STATUS.ONGOING] };
      } else if (req.query.bookingType == constants.BOOKING_STATUS.COMPLETED) {
        qry.bookingStatus = { $in: [constants.BOOKING_STATUS.COMPLETED] };
      } else if (req.query.bookingType == constants.BOOKING_STATUS.UPCOMING) {
        qry.bookingStatus = { $in: [constants.BOOKING_STATUS.PENDING, constants.BOOKING_STATUS.ACCEPTED] };
      } else if (req.query.bookingType == constants.BOOKING_STATUS.CANCELLED) {
        qry.bookingStatus = { $in: [constants.BOOKING_STATUS.CANCELLED, constants.BOOKING_STATUS.REJECTED] };
      }
      
      let pipeline = [{
        $match:{
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
          $match: qry
        },{
          $project: {
            bookingNumber: 1,
            totalNoOfHours: 1,
            "tutors.name": 1,
            "tutors.email": 1,
            "parents.name": 1,
            "parents.email": 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails.classStart": 1,
            "bookingdetails.classEnd": 1,
            "bookingdetails.cancelledAt": 1,
            "bookingdetails.bookingStatus": 1,
            "subjects.name": 1,
            classId: 1,
            bookingStatus: 1,
            OrderTrackingId: 1,
            createdAt: 1,
            grandTotal: 1,
            invoiceNo: 1,
            cancelledAt: 1,
            cancelReason: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ];
      pipeline = await common.pagination(pipeline, skip, limit);
      let [booking] = await Model.Booking.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        booking: booking.data,
        totalBooking: booking.total
      });

    } else {
      let pipeline = [{
          $match: { _id: ObjectId(req.params.id) }
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
            from: "subjects",
            localField: "subjectId",
            foreignField: "_id",
            as: "subjects"
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
          $lookup: {
            from: "bookingdetails",
            localField: "_id",
            foreignField: "bookingId",
            as: "bookingdetails"
          }
        },{
          $project: {
            bookingNumber: 1,
            "tutors.name": 1,
            "tutors.email": 1,
            "tutors.phoneNo": 1,
            "parents.name": 1,
            "parents.email": 1,
            "parents.phoneNo": 1,
            subjects: 1,
            classId: 1,
            "bookingdetails.date": 1,
            "bookingdetails.startTime": 1,
            "bookingdetails.endTime": 1,
            "bookingdetails.classStart": 1,
            "bookingdetails.classEnd": 1,
            "bookingdetails.cancelledAt": 1,
            "bookingdetails.bookingStatus": 1,
            parentAddress: 1,
            totalNoOfHours: 1,
            bookingStatus: 1,
            OrderTrackingId: 1,
            grandTotal: 1,
            invoiceNo: 1,
            cancelReason: 1,
            cancelledAt: 1
          }
        }];
    
      let [booking] = await Model.Booking.aggregate(pipeline);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, booking);
    }

  } catch (error) {
    next(error);
  }
};
module.exports.bookingExport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const user = [];
    let qry = {};

    if (req.query.isOnline === 'true') {
      qry.classModeOnline = true;
    } else if (req.query.isOnline === 'false') {
      qry.classModeOnline = false;
    }

    if (req.query.bookingType == constants.BOOKING_STATUS.ONGOING) {
      qry.bookingStatus = {
        $in: [constants.BOOKING_STATUS.ONGOING]
      };
    } else if (req.query.bookingType == constants.BOOKING_STATUS.COMPLETED) {
      qry.bookingStatus = {
        $in: [
          constants.BOOKING_STATUS.COMPLETED,
          constants.BOOKING_STATUS.REJECTED,
          constants.BOOKING_STATUS.CANCELLED
        ]
      };
    } else if (req.query.bookingType == constants.BOOKING_STATUS.UPCOMING) {
      qry.bookingStatus = {
        $in: [constants.BOOKING_STATUS.PENDING, constants.BOOKING_STATUS.ACCEPTED]
      };
    }

    let pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },
      { $unwind: "$tutors" },
      {
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
        }
      },
      { $unwind: "$parents" },
      {
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
          from: "bookingdetails",
          localField: "_id",
          foreignField: "bookingId",
          as: "bookingdetails"
        }
      },
      { $unwind: "$bookingdetails" },
      { $match: qry }
    ];

    let data = await Model.Booking.aggregate(pipeline);

    data.forEach((item) => {
      user.push({
        bookingId: item.bookingNumber,
        OrderTrackingId: item.OrderTrackingId,
        customerName: item.parents.name,
        customerEmail: item.parents.email,
        tutorName: item.tutors.name,
        tutorEmail: item.tutors.email,
        subjects: item.subjects.name,
        date: item.bookingdetails.date
      });
    });

    const csvData = await jsonexport(user);

    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });

    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'booking.csv',
      Body: csvData
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        throw new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
      }
      console.log('File uploaded successfully', data.Location);
      res.success({
        message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
        s3Location: data.Location
      });
    });
  } catch (error) {
    next(error);
  }
};

//Invoice
module.exports.invoice = async (req, res, next) => {
  try {
    let lang = req.headers.language || "en";
    let id = req.params.id;

    let pipeline = [{
        $match: { _id: ObjectId(id) }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
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
          from: "bookingdetails",
          localField: "_id",
          foreignField: "bookingId",
          as: "bookingdetails"
        }
      },{
        $project: {
          bookingNumber: 1,
          "tutors.name": 1,
          "tutors.email": 1,
          "tutors.phoneNo": 1,
          "parents.name": 1,
          "parents.email": 1,
          "parents.phoneNo": 1,
          "parents.address": 1,
          "subjects.name": 1,
          "bookingdetails.date": 1,
          "bookingdetails.startTime": 1,
          "bookingdetails.endTime": 1,
          totalNoOfHours: 1,
          bookingStatus: 1,
          OrderTrackingId: 1,
          grandTotal: 1,
          invoiceNo: 1,
          totalPrice: 1,
          serviceFees: 1,
          totalTransportationFees: 1,
          createdAt: 1
        }
      }];

    let [booking] = await Model.Booking.aggregate(pipeline);
    if (!booking) {
      return res.error("Booking not found");
    }

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
    .invoice-box { max-width: 800px; margin: 30px auto; padding: 30px; border: 1px solid #eee; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .header img { max-width: 150px; }
    .company-details { text-align: right; }
    .client-details { margin-top: 20px; }
    .invoice-details { margin: 20px 0; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border: 1px solid #ddd; padding: 8px; }
    .table th { background: #f4f4f4; }
    .payment-info { display: flex; justify-content: space-between; margin-top: 20px; }
    .total { text-align: right; }
    .thank-you { text-align: center; margin-top: 40px; font-size: 18px; }
    .footer { border-top: 1px solid #eee; margin-top: 30px; padding-top: 10px; text-align: center; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Company Logo">
      <div class="company-details">
        <p><strong>TutorHail Pvt. Ltd</strong></p>
        <p>Alvin Buye</p>
        <p>tutorhailapp@gmail.com</p>
      </div>
    </div>

    <div class="client-details">
      <p><strong>Invoice Date:</strong> ${new Date(booking.createdAt).toDateString()}</p>
      <p><strong>Invoice No:</strong> ${booking.invoiceNo}</p>
      <p><strong>Parent Name:</strong> ${booking.parents[0]?.name || ''}</p>
      <p><strong>Parent Email:</strong> ${booking.parents[0]?.email || ''}</p>
    </div>

    <div class="invoice-details">
      <h2>Invoice</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tutor Fee</td>
            <td>${booking.totalPrice}</td>
          </tr>
          <tr>
            <td>Service Fee</td>
            <td>${booking.serviceFees}</td>
          </tr>
          <tr>
            <td>Transportation Fee</td>
            <td>${booking.totalTransportationFees.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="payment-info">
      <div>
        <p><strong>Booking ID:</strong> ${booking.bookingNumber}</p>
        <p><strong>Course:</strong> ${booking.subjects?.name || ''}</p>
      </div>
      <div class="total">
        <h3>Total: ${booking.grandTotal}</h3>
      </div>
    </div>

    <div class="thank-you">
      ❤️ Thank you for your business!
    </div>

    <div class="footer">
      tutorhailapp@gmail.com | +256 77 106 2909
    </div>
  </div>
</body>
</html>
    `;

    const options = {
      format: 'A4',
      path: `./uploads/invoice.pdf`,
      printBackground: true
    };

    await pdf.generatePdf({ content: html }, options);

    const fileContent = await fs.readFileSync('./uploads/invoice.pdf');

    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });

    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `invoice.pdf`,
      Body: fileContent
    };

    await s3.upload(params, function (err, data) {
      if (err) {
        throw err;
      } else {
        let obj = {
          statusCode: 200,
          data: data.Location,
          link: data.Location,
          message: "SUCCESS"
        };
        return res.success(constants.MESSAGES[lang].SUCCESS, obj);
      }
    });

  } catch (error) {
    next(error);
  }
};

//Reviews
module.exports.getReviews = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let id = req.params.id;
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    if (id == null) {
      let qry = {};
      let pipeline = [{
          $match: { isDeleted: false }
        },{
          $match: qry
        },{
          $lookup: {
            from: "users",
            localField: "tutorId",
            foreignField: "_id",
            as: "tutors"
          }
        },{
          $lookup: {
            from: "users",
            localField: "parentId",
            foreignField: "_id",
            as: "parents"
          }
        },{
          $lookup: {
            from: "bookings",
            localField: "bookingId",
            foreignField: "_id",
            as: "bookings"
          }
        },{
          $sort: { createdAt: -1 }
        },{
          $project: {
            "bookings.bookingNumber": 1,
            "tutors.name": 1,
            "parents.name": 1,
            rating: 1,
            review: 1
          }
        }];

      pipeline = await common.pagination(pipeline, skip, limit);
      let [rating] = await Model.Rating.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        rating: rating.data,
        totalRating: rating.total
      });

    } else {
      let pipeline = [{
          $match: {
            _id: ObjectId(id),
            isDeleted: false
          }
        },{
          $lookup: {
            from: "users",
            localField: "tutorId",
            foreignField: "_id",
            as: "tutors"
          }
        },{
          $lookup: {
            from: "users",
            localField: "parentId",
            foreignField: "_id",
            as: "parents"
          }
        },{
          $project: {
            _id: 1,
            "tutors.name": 1,
            "parents.name": 1,
            rating: 1,
            review: 1
          }
        }];

      let [rating] = await Model.Rating.aggregate(pipeline);
      return res.success(constants.MESSAGES[lang].DATA_FETCHED, rating);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.deleteReview = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const review = await Model.Rating.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      isDeleted: false
    }, {
      isDeleted: true
    }, {
      new: true
    });
    return res.success(constants.MESSAGES[lang].REVIEW_DELETED_SUCCESSFULLY, review);
  } catch (error) {
    next(error);
  }
};

//Reports and Analytics
module.exports.userGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const date2 = moment(new Date());
    const StartofWeek = new Date(date2.startOf("week"));
    const EndofWeek = new Date(date2.endOf("week"));
    const date3 = moment(new Date());
    const startOFMonth = new Date(date3.startOf("month"));
    const endOFMonth = new Date(date3.endOf("month"));
    const date4 = moment(new Date());
    const startOFYear = new Date(date4.startOf("years"));
    const endOFYear = new Date(date4.endOf("years"));
    let users;
    let qry = {};
    let Brr;

    if (req.query.type === "daily") {
      let D1 = 0,
        D2 = 0,
        D3 = 0,
        D4 = 0,
        D5 = 0,
        D6 = 0,
        D7 = 0;
      users = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.PARENT,
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
      users.map((val) => {
        let day = moment(val.createdAt).format("dd");
        // eslint-disable-next-line default-case
        switch (day) {
          case "Mo":
            D1 = D1 + 1;
            break;
          case "Tu":
            D2 = D2 + 1;
            break;
          case "We":
            D3 = D3 + 1;
            break;
          case "Th":
            D4 = D4 + 1;
            break;
          case "Fr":
            D5 = D5 + 1;
            break;
          case "Sa":
            D6 = D6 + 1;
            break;
          case "Su":
            D7 = D7 + 1;
            break;
        }
      });
      let Brr = [D1, D2, D3, D4, D5, D6, D7];
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
      users = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.PARENT,
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
      users.map((val) => {
        let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
        // eslint-disable-next-line default-case
        switch (week) {
          case 1:
            W1 = W1 + 1;
            break;
          case 2:
            W2 = W2 + 1;
            break;
          case 3:
            W3 = W3 + 1;
            break;
          case 4:
            W4 = W4 + 1;
            break;
          case 5:
            W5 = W5 + 1;
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

      users = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.PARENT,
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

      users.map((val) => {
        let month = Math.ceil(Number(moment(val.createdAt).format("M")));

        // eslint-disable-next-line default-case
        switch (month) {
          case 1:
            M1 = M1 + 1;
            break;
          case 2:
            M2 = M2 + 1;
            break;
          case 3:
            M3 = M3 + 1;
            break;
          case 4:
            M4 = M4 + 1;
            break;
          case 5:
            M5 = M5 + 1;
            break;
          case 6:
            M6 = M6 + 1;
            break;
          case 7:
            M7 = M7 + 1;
            break;
          case 8:
            M8 = M8 + 1;
            break;
          case 9:
            M9 = M9 + 1;
            break;
          case 10:
            M10 = M10 + 1;
            break;
          case 11:
            M11 = M11 + 1;
            break;
          case 12:
            M12 = M12 + 1;
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
      users = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.PARENT,
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
              $sum: 1
            }
          }
        }
      ]);
      let map = [];
      users.map(row => {
        map.push({
          name: row._id,
          value: row.total
        });
      });
      Brr = map;
    }

    const csvData = await jsonexport(Brr);
    if (req.query.export == "csv") {
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
      });
      const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'userGraph.csv',
        Body: csvData
      };

      s3.upload(params, (err, data) => {
        if (err) {
          console.error(err);
          return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
        }
        console.log('File uploaded successfully', data.Location);
        res.success({
          message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
          s3Location: data.Location
        });
      });
    } else
      return res.send({
        statusCode: 200,
        message: constants.MESSAGES[lang].DATA_FETCHED,
        data: Brr
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
};
module.exports.tutorGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const date2 = moment(new Date());
    const StartofWeek = new Date(date2.startOf("week"));
    const EndofWeek = new Date(date2.endOf("week"));
    const date3 = moment(new Date());
    const startOFMonth = new Date(date3.startOf("month"));
    const endOFMonth = new Date(date3.endOf("month"));
    const date4 = moment(new Date());
    const startOFYear = new Date(date4.startOf("years"));
    const endOFYear = new Date(date4.endOf("years"));
    let tutor;
    let qry = {};
    let Brr;

    if (req.query.type === "daily") {
      let D1 = 0,
        D2 = 0,
        D3 = 0,
        D4 = 0,
        D5 = 0,
        D6 = 0,
        D7 = 0;
      tutor = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.TUTOR,
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
      tutor.map((val) => {
        let day = moment(val.createdAt).format("dd");
        // eslint-disable-next-line default-case
        switch (day) {
          case "Mo":
            D1 = D1 + 1;
            break;
          case "Tu":
            D2 = D2 + 1;
            break;
          case "We":
            D3 = D3 + 1;
            break;
          case "Th":
            D4 = D4 + 1;
            break;
          case "Fr":
            D5 = D5 + 1;
            break;
          case "Sa":
            D6 = D6 + 1;
            break;
          case "Su":
            D7 = D7 + 1;
            break;
        }
      });
      let Brr = [D1, D2, D3, D4, D5, D6, D7];
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
      tutor = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.TUTOR,
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
      tutor.map((val) => {
        let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
        // eslint-disable-next-line default-case
        switch (week) {
          case 1:
            W1 = W1 + 1;
            break;
          case 2:
            W2 = W2 + 1;
            break;
          case 3:
            W3 = W3 + 1;
            break;
          case 4:
            W4 = W4 + 1;
            break;
          case 5:
            W5 = W5 + 1;
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

      tutor = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.TUTOR,
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

      tutor.map((val) => {
        let month = Math.ceil(Number(moment(val.createdAt).format("M")));
        // eslint-disable-next-line default-case
        switch (month) {
          case 1:
            M1 = M1 + 1;
            break;
          case 2:
            M2 = M2 + 1;
            break;
          case 3:
            M3 = M3 + 1;
            break;
          case 4:
            M4 = M4 + 1;
            break;
          case 5:
            M5 = M5 + 1;
            break;
          case 6:
            M6 = M6 + 1;
            break;
          case 7:
            M7 = M7 + 1;
            break;
          case 8:
            M8 = M8 + 1;
            break;
          case 9:
            M9 = M9 + 1;
            break;
          case 10:
            M10 = M10 + 1;
            break;
          case 11:
            M11 = M11 + 1;
            break;
          case 12:
            M12 = M12 + 1;
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
      tutor = await Model.User.aggregate([{
          $match: {
            role: constants.APP_ROLE.TUTOR,
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
              $sum: 1
            }
          }
        }
      ]);
      let map = [];
      tutor.map(row => {
        map.push({
          name: row._id,
          value: row.total
        });
      });
      Brr = map;
    }
    const csvData = await jsonexport(Brr);
    if (req.query.export == "csv") {
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
      });
      const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'tutorGraph.csv',
        Body: csvData
      };

      s3.upload(params, (err, data) => {
        if (err) {
          console.error(err);
          return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
        }
        console.log('File uploaded successfully', data.Location);
        res.success({
          message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
          s3Location: data.Location
        });
      });
    } else
      return res.send({
        statusCode: 200,
        message: constants.MESSAGES[lang].DATA_FETCHED,
        data: Brr
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
};
module.exports.bookingGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const date2 = moment(new Date());
    const StartofWeek = new Date(date2.startOf("week"));
    const EndofWeek = new Date(date2.endOf("week"));
    const date3 = moment(new Date());
    const startOFMonth = new Date(date3.startOf("month"));
    const endOFMonth = new Date(date3.endOf("month"));
    const date4 = moment(new Date());
    const startOFYear = new Date(date4.startOf("years"));
    const endOFYear = new Date(date4.endOf("years"));
    let booking;
    let qry = {};
    let Brr;

    if (req.query.type === "daily") {
      let D1 = 0,
        D2 = 0,
        D3 = 0,
        D4 = 0,
        D5 = 0,
        D6 = 0,
        D7 = 0;
      booking = await Model.Booking.aggregate([{
          $match: {
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
      booking.map((val) => {
        let day = moment(val.createdAt).format("dd");
        // eslint-disable-next-line default-case
        switch (day) {
          case "Mo":
            D1 = D1 + 1;
            break;
          case "Tu":
            D2 = D2 + 1;
            break;
          case "We":
            D3 = D3 + 1;
            break;
          case "Th":
            D4 = D4 + 1;
            break;
          case "Fr":
            D5 = D5 + 1;
            break;
          case "Sa":
            D6 = D6 + 1;
            break;
          case "Su":
            D7 = D7 + 1;
            break;
        }
      });
      let Brr = [D1, D2, D3, D4, D5, D6, D7];
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
      booking = await Model.Booking.aggregate([{
          $match: {
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
      booking.map((val) => {
        let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
        // eslint-disable-next-line default-case
        switch (week) {
          case 1:
            W1 = W1 + 1;
            break;
          case 2:
            W2 = W2 + 1;
            break;
          case 3:
            W3 = W3 + 1;
            break;
          case 4:
            W4 = W4 + 1;
            break;
          case 5:
            W5 = W5 + 1;
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

      booking = await Model.Booking.aggregate([{
          $match: {
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

      booking.map((val) => {
        let month = Math.ceil(Number(moment(val.createdAt).format("M")));

        // eslint-disable-next-line default-case
        switch (month) {
          case 1:
            M1 = M1 + 1;
            break;
          case 2:
            M2 = M2 + 1;
            break;
          case 3:
            M3 = M3 + 1;
            break;
          case 4:
            M4 = M4 + 1;
            break;
          case 5:
            M5 = M5 + 1;
            break;
          case 6:
            M6 = M6 + 1;
            break;
          case 7:
            M7 = M7 + 1;
            break;
          case 8:
            M8 = M8 + 1;
            break;
          case 9:
            M9 = M9 + 1;
            break;
          case 10:
            M10 = M10 + 1;
            break;
          case 11:
            M11 = M11 + 1;
            break;
          case 12:
            M12 = M12 + 1;
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
      booking = await Model.Booking.aggregate([{
          $match: {
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
              $sum: 1
            }
          }
        }
      ]);
      let map = [];
      booking.map(row => {
        map.push({
          name: row._id,
          value: row.total
        });
      });
      Brr = map;
    }
    const csvData = await jsonexport(Brr);
    if (req.query.export == "csv") {
      const s3 = new aws.S3({
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
      });
      const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: 'bookingGraph.csv',
        Body: csvData
      };

      s3.upload(params, (err, data) => {
        if (err) {
          console.error(err);
          return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
        }
        console.log('File uploaded successfully', data.Location);
        res.success({
          message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
          s3Location: data.Location
        });
      });
    } else
      return res.send({
        statusCode: 200,
        message: constants.MESSAGES[lang].DATA_FETCHED,
        data: Brr
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
};
module.exports.followerGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const date2 = moment(new Date());
    const StartofWeek = new Date(date2.startOf("week"));
    const EndofWeek = new Date(date2.endOf("week"));
    const date3 = moment(new Date());
    const startOFMonth = new Date(date3.startOf("month"));
    const endOFMonth = new Date(date3.endOf("month"));
    const date4 = moment(new Date());
    const startOFYear = new Date(date4.startOf("years"));
    const endOFYear = new Date(date4.endOf("years"));
    let users, Brr;

    if (req.query.type === "daily") {
      let D1 = 0,
        D2 = 0,
        D3 = 0,
        D4 = 0,
        D5 = 0,
        D6 = 0,
        D7 = 0;
      users = await Model.Follow.aggregate([{
          $match: {
            createdAt: {
              $gte: StartofWeek,
              $lte: EndofWeek
            }
          }
        }
      ]);
      users.map((val) => {
        let day = moment(val.createdAt).format("dd");
        // eslint-disable-next-line default-case
        switch (day) {
          case "Mo":
            D1 = D1 + 1;
            break;
          case "Tu":
            D2 = D2 + 1;
            break;
          case "We":
            D3 = D3 + 1;
            break;
          case "Th":
            D4 = D4 + 1;
            break;
          case "Fr":
            D5 = D5 + 1;
            break;
          case "Sa":
            D6 = D6 + 1;
            break;
          case "Su":
            D7 = D7 + 1;
            break;
        }
      });
      let Brr = [D1, D2, D3, D4, D5, D6, D7];
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
      users = await Model.Follow.aggregate([{
          $match: {
            createdAt: {
              $gte: startOFMonth,
              $lte: endOFMonth
            }
          }
        }
      ]);
      users.map((val) => {
        let week = Math.ceil(Number(moment(val.createdAt).format("D")) / 7);
        // eslint-disable-next-line default-case
        switch (week) {
          case 1:
            W1 = W1 + 1;
            break;
          case 2:
            W2 = W2 + 1;
            break;
          case 3:
            W3 = W3 + 1;
            break;
          case 4:
            W4 = W4 + 1;
            break;
          case 5:
            W5 = W5 + 1;
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

      users = await Model.Follow.aggregate([{
          $match: {
            createdAt: {
              $gte: startOFYear,
              $lte: endOFYear
            }
          }
        }
      ]);

      users.map((val) => {
        let month = Math.ceil(Number(moment(val.createdAt).format("M")));

        // eslint-disable-next-line default-case
        switch (month) {
          case 1:
            M1 = M1 + 1;
            break;
          case 2:
            M2 = M2 + 1;
            break;
          case 3:
            M3 = M3 + 1;
            break;
          case 4:
            M4 = M4 + 1;
            break;
          case 5:
            M5 = M5 + 1;
            break;
          case 6:
            M6 = M6 + 1;
            break;
          case 7:
            M7 = M7 + 1;
            break;
          case 8:
            M8 = M8 + 1;
            break;
          case 9:
            M9 = M9 + 1;
            break;
          case 10:
            M10 = M10 + 1;
            break;
          case 11:
            M11 = M11 + 1;
            break;
          case 12:
            M12 = M12 + 1;
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
      users = await Model.Follow.aggregate([{
          $addFields: {
            year: {
              $year: "$createdAt"
            }
          }
        },{
          $group: {
            _id: "$year",
            total: {
              $sum: 1
            }
          }
        }
      ]);
      let map = [];
      users.map(row => {
        map.push({
          name: row._id,
          value: row.total
        });
      });
      Brr = map;
    }
      return res.send({
        statusCode: 200,
        message: constants.MESSAGES[lang].DATA_FETCHED,
        data: Brr
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
};
module.exports.contentViewsGraph = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const date2 = moment(new Date());
    const StartofWeek = new Date(date2.startOf("week"));
    const EndofWeek = new Date(date2.endOf("week"));
    const date3 = moment(new Date());
    const startOFMonth = new Date(date3.startOf("month"));
    const endOFMonth = new Date(date3.endOf("month"));
    const date4 = moment(new Date());
    const startOFYear = new Date(date4.startOf("year"));
    const endOFYear = new Date(date4.endOf("year"));

    const CONTENT_TYPE = {
      FORUM: 1,
      SHORT_VIDEO: 2,
      TEASER_VIDEO: 3,
      POST: 4
    };

    let users, Brr = {};

    const initArray = (length, labels) => labels.map(name => ({ name, value: 0 }));

    if (req.query.type === "daily") {
      const dayArr = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
      Object.values(CONTENT_TYPE).forEach(type => {
        Brr[type] = initArray(7, dayArr);
      });

      users = await Model.ContentViews.aggregate([
        { $match: { createdAt: { $gte: StartofWeek, $lte: EndofWeek } } },
        {
          $lookup: {
            from: "contents",
            localField: "contentId",
            foreignField: "_id",
            as: "contentData"
          }
        },
        { $unwind: "$contentData" },
        {
          $group: {
            _id: { day: { $dayOfWeek: "$createdAt" }, contentType: "$contentData.contentType" },
            count: { $sum: 1 }
          }
        }
      ]);

      users.forEach(val => {
        let dayIndex;
        switch (val._id.day) {
          case 1: dayIndex = 6; break; 
          case 2: dayIndex = 0; break;
          case 3: dayIndex = 1; break;
          case 4: dayIndex = 2; break;
          case 5: dayIndex = 3; break;
          case 6: dayIndex = 4; break;
          case 7: dayIndex = 5; break;
          default: break;
        }
        if (Brr[val._id.contentType]) {
          Brr[val._id.contentType][dayIndex].value += val.count;
        }
      });

    } else if (req.query.type === "weekly") {
      const weekArr = ["WEEK 1", "WEEK 2", "WEEK 3", "WEEK 4", "WEEK 5"];
      Object.values(CONTENT_TYPE).forEach(type => {
        Brr[type] = initArray(5, weekArr);
      });

      users = await Model.ContentViews.aggregate([
        { $match: { createdAt: { $gte: startOFMonth, $lte: endOFMonth } } },
        {
          $lookup: {
            from: "contents",
            localField: "contentId",
            foreignField: "_id",
            as: "contentData"
          }
        },
        { $unwind: "$contentData" },
        {
          $group: {
            _id: { date: "$createdAt", contentType: "$contentData.contentType" },
            count: { $sum: 1 }
          }
        }
      ]);

      users.forEach(val => {
        const weekIndex = Math.ceil(Number(moment(val._id.date).format("D")) / 7) - 1;
        if (Brr[val._id.contentType]) {
          Brr[val._id.contentType][weekIndex].value += val.count;
        }
      });

    } else if (req.query.type === "monthly") {
      const mnthArr = ["JAN", "FEB", "MAR", "APRIL", "MAY", "JUNE", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      Object.values(CONTENT_TYPE).forEach(type => {
        Brr[type] = initArray(12, mnthArr);
      });

      users = await Model.ContentViews.aggregate([
        { $match: { createdAt: { $gte: startOFYear, $lte: endOFYear } } },
        {
          $lookup: {
            from: "contents",
            localField: "contentId",
            foreignField: "_id",
            as: "contentData"
          }
        },
        { $unwind: "$contentData" },
        {
          $group: {
            _id: { date: "$createdAt", contentType: "$contentData.contentType" },
            count: { $sum: 1 }
          }
        }
      ]);

      users.forEach(val => {
        const monthIndex = Number(moment(val._id.date).format("M")) - 1;
        if (Brr[val._id.contentType]) {
          Brr[val._id.contentType][monthIndex].value += val.count;
        }
      });

    } else if (req.query.type === "yearly") {
      Object.values(CONTENT_TYPE).forEach(type => {
        Brr[type] = [];
      });

      users = await Model.ContentViews.aggregate([
        {
          $lookup: {
            from: "contents",
            localField: "contentId",
            foreignField: "_id",
            as: "contentData"
          }
        },
        { $unwind: "$contentData" },
        { $addFields: { year: { $year: "$createdAt" } } },
        {
          $group: {
            _id: { year: "$year", contentType: "$contentData.contentType" },
            total: { $sum: 1 }
          }
        }
      ]);

      users.forEach(val => {
        if (Brr[val._id.contentType]) {
          Brr[val._id.contentType].push({ name: val._id.year, value: val.total });
        }
      });
    }

    return res.send({
      statusCode: 200,
      message: constants.MESSAGES[lang].DATA_FETCHED,
      data: Brr
    });

  } catch (e) {
    console.log(e);
    next(e);
  }
};

//CustomerSupport
module.exports.support = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 10;
    let skip = (page - 1) * limit;

    let qry = {};
    if (req.query.supportType) {
      qry.supportType = Number(req.query.supportType);
    }

    let pipeline = [{
        $match: {
          isDeleted: false
        }
      },{
        $lookup: {
          from: "users",
          localField: "tutorId", 
          foreignField: "_id",
          as: "tutors"
        }
      },{
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parents"
        }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          "tutors._id": 1,
          "tutors.name": 1,
          "parents._id": 1,
          "parents.name": 1,
          "tutors.email": 1,
          "parents.email": 1,
          supportType: 1,
          title: 1,
          query: 1,
          createdAt: 1
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [query] = await Model.CustomerSupport.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      query: query.data,
      totalQuery: query.total
    });
  } catch (error) {
    next(error);
  }
};
module.exports.deleteSupport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let support = await Model.CustomerSupport.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    },{
      $set: {
        isDeleted: true
      }
    },{
      new: true
    });
    return res.success(constants.MESSAGES[lang].SUCCESS, support);
  } catch (error) {
    next(error);
  }
};
module.exports.revertQuery = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.revertQuery.validateAsync(req.body);
    let query = await Model.CustomerSupport.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (query.customerType === constants.CUSTOMER_TYPE.PARENT) {
      let parentId = query.parentId;
      let parent = await Model.User.findById(parentId);
      let payload = {
        title: "Revert for your query or complaint",
        name: parent.name,
        email: parent.email,
        query: query.query,
        revertQuery: req.body.revertQuery
      };
      await services.EmalService.queryEmail(payload);
    }

    if (query.customerType === constants.CUSTOMER_TYPE.TUTOR) {
      let tutorId = query.tutorId;
      let tutor = await Model.User.findById(tutorId);
      let payload = {
        title: "Revert for your query or complaint",
        name: tutor.name,
        email: tutor.email,
        query: query.query,
        revertQuery: req.body.revertQuery
      };
      await services.EmalService.queryEmail(payload);
    }

    let update = await Model.CustomerSupport.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      isDeleted: false
    }, {
      $set: req.body
    }, {
      new: true
    });

    let revertId, roles;
    if (update) {
      if (update.customerType == constants.CUSTOMER_TYPE.TUTOR) {
        revertId = update.tutorId;
        roles = constants.ROLE.TUTOR;
      } else if (update.customerType == constants.CUSTOMER_TYPE.PARENT) {
        revertId = update.parentId;
        roles = constants.ROLE.PARENT;
      }

      let notificationType;
      if (update.supportType == constants.SUPPORT_TYPE.COMPLAINT) {
        notificationType = constants.PUSH_TYPE_KEYS.REVERT_COMPLAINT;
      } else if (update.supportType == constants.SUPPORT_TYPE.QUERY) {
        notificationType = constants.PUSH_TYPE_KEYS.REVERT_QUERY;
      }

      process.emit("sendNotification", {
        tutorId: revertId,
        receiverId: revertId,
        values: update,
        role: roles,
        query: update.query,
        revertQuery: update.revertQuery,
        isNotificationSave: true,
        pushType: notificationType
      });

      process.emit("sendNotification", {
        parentId: revertId,
        receiverId: revertId,
        values: update,
        role: roles,
        query: update.query,
        revertQuery: update.revertQuery,
        isNotificationSave: true,
        pushType: notificationType
      });
    }
    return res.success(constants.MESSAGES[lang].SUCCESS, update);
  } catch (error) {
    next(error);
  }
};

//Notifications
module.exports.addNotification = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.addNotification.validateAsync(req.body);

    console.log(req.body,"BODY>>>>>>>>>>>>>>>>>>");
    console.log(req.body.role,"ROLE>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    let payload = {
      message: req.body.message,
      title: req.body.title,
      role: req.body.role,
      pushType: constants.PUSH_TYPE_KEYS.DEFAULT,
      notificationType: constants.NOTIFICATION_TYPE.BROADCAST,
      lang: req.body.lang || 'en',
      isBroadcast: true
    };
    process.emit("prepareBroadcastPushNotifictions", payload);
    await Model.Notification(payload).save();
    return res.success(constants.MESSAGES[lang].SUCCESS, payload);
  } catch (error) {
    next(error);
  }
};
module.exports.getNotification = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let id = req.params.id;
    if (id == null) {
      let qry = {};
      if (req.query.search) {
        const regex = new RegExp(req.query.search, "i");
        qry._search = regex;
      }
      if (req.query.pushType == "listing") {
        qry.pushType = {
          $in: [constants.PUSH_TYPE_KEYS.DEFAULT]
        };
        qry.isBroadcast = true;
      } else if (req.query.pushType == "icon") {
        qry.role = Number(constants.ROLE.ADMIN);
        qry.isBroadcast = false;
      }

      let pipeline = [{
          $match: {
            isDeleted: false
          }
        },{
          $addFields: {
            _search: {
              $concat: ["$title", "$message"]
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
      let [notification] = await Model.Notification.aggregate(pipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        notification: notification.data,
        totalNotification: notification.total
      });
    } else {
      let notification = await Model.Notification.findOne({
        _id: ObjectId(req.params.id),
        isDeleted: false
      });
      if (notification == null) throw new Error(constants.MESSAGES.NOTIFICATION_NOT_FOUND);
      return res.success(constants.MESSAGES.DATA_FETCHED, notification);
    }
  } catch (error) {
    next(error);
  }
};
module.exports.deleteNotification = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let deleteNotification = await Model.Notification.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    },{
      isDeleted: true
    },{
      new: true
    });
    return res.success(constants.MESSAGES[lang].NOTIFICATION_DELETED_SUCCESSFULLY, deleteNotification);
  } catch (error) {
    next(error);
  }
};

//Setting
module.exports.addSetting = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.setting.validateAsync(req.body);
    
    const existingSetting = await Model.AppSetting.findOne({
      currency: req.body.currency,
      countryCode: req.body.countryCode,
      isDeleted: false
    });

    if (existingSetting) {
      throw new Error(constants.MESSAGES[lang].SETTING_ALREADY_EXISTS);
    }

    const setting = await Model.AppSetting.create(req.body);

    return res.success(
      constants.MESSAGES[lang].SETTING_CREATED_SUCCESSFULLY,
      setting
    );
  } catch (error) {
    next(error);
  }
};

// ✅ Update Setting by ID
module.exports.updateSetting = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.setting.validateAsync(req.body);

    // Check if currency already exists for a different setting
    if (req.body.currency) {
      const existingSetting = await Model.AppSetting.findOne({
        currency: req.body.currency,
        countryCode: req.body.countryCode,
        _id: { $ne: ObjectId(req.params.id) },
        isDeleted: false
      });
      if (existingSetting) {
        throw new Error(constants.MESSAGES[lang].SETTING_ALREADY_EXISTS);
      }
    }

    const setting = await Model.AppSetting.findByIdAndUpdate(
      { _id: ObjectId(req.params.id) },
      { $set: req.body },
      { new: true }
    );

    if (!setting) {
      return res.notFound(constants.MESSAGES[lang].SETTING_NOT_FOUND);
    }

    return res.success(
      constants.MESSAGES[lang].SETTING_UPDATED_SUCCESSFULLY,
      setting
    );
  } catch (error) {
    next(error);
  }
};

// ✅ Delete Setting by ID
module.exports.deleteSetting = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    // 1. Check if setting exists and not already deleted
    const settingData = await Model.AppSetting.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: { $ne: true }
    });

    if (!settingData) {
      throw new Error(constants.MESSAGES[lang].SETTING_NOT_FOUND);
    }

    // 3. Soft delete (set isDeleted = true)
    const doc = await Model.AppSetting.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { isDeleted: true },
      { new: true }
    );

    return res.success(constants.MESSAGES[lang].SETTING_DELETED_SUCCESSFULLY, doc);
  } catch (error) {
    next(error);
  }
};

module.exports.getSetting = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let pipeline = [];
    let qry = {};

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [
        { currency: searchRegex },
        { countryCode: searchRegex }
      ];
    }

    pipeline.push({
      $match: {
        isDeleted: { $ne: true },
        ...qry
      }
    });
    pipeline.push({
      $sort: {
        createdAt: -1
      }
    });
    pipeline.push({
      $project: {
        distanceType: 1,
        distanceAmount: 1,
        serviceType: 1,
        serviceFees: 1,
        currency: 1,
        countryCode: 1,
        createdAt: 1
      }
    });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [settings] = await Model.AppSetting.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, settings);
  } catch (error) {
    next(error);
  }
};

module.exports.getSettingById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const setting = await Model.AppSetting.findById(ObjectId(req.params.id));

    if (!setting) {
      return res.notFound(constants.MESSAGES[lang].SETTING_NOT_FOUND);
    }

    return res.success(constants.MESSAGES.DATA_FETCHED, setting);
  } catch (error) {
    next(error);
  }
};

//Refund
module.exports.refundBookingAmount = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let booking = await Model.Booking.findById(req.params.id);
    if (!booking) {
      throw new Error(constants.MESSAGES[lang].BOOKING_NOT_FOUND);
    }
    if (booking.bookingStatus == constants.BOOKING_STATUS.CANCELLED) {
      throw new Error(constants.MESSAGES[lang].BOOKING_CANCELLED);
    }

    const doc = await Model.Booking.findOneAndUpdate({
      _id: ObjectId(req.params.id),
      tutorId: booking.tutorId,
      isDeleted: false
    },{
      $set: req.body
    },{
      new: true
    }).populate("parentId", "name");

    let confirmationCode = doc.confirmationCode;
    let payment = doc.totalPrice/2;
    let name = doc.parentId.name;

    await Model.BookingDetails.updateMany({
      bookingId: doc._id
    },{
      $set: {
        bookingStatus: constants.BOOKING_STATUS.CANCELLED
      },
      new: true
    });

    await cart.refundPayment(confirmationCode, payment, name);

    await Model.Booking.findOneAndUpdate({
      _id: ObjectId(req.params.id)
    },{
      $set: {
        refundAmount: payment,
        isRefunded: true,
        refundDate: Date.now()
      }
    },{
      new: true
    });
    process.emit("sendNotification", {
      parentId:doc.parentId._id,
      receiverId: doc.parentId._id,
      values: doc,
      role: constants.ROLE.PARENT,
      isNotificationSave: true,
      pushType: constants.PUSH_TYPE_KEYS.REFUND_PAYMENT
    });

    return res.success(
      constants.MESSAGES[lang].REFUND_REQUEST_ACCEPTED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};
module.exports.refundList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);

    let pipeline = [];
    let qry = {};

    if(req.query.isRefunded){
      if(req.query.isRefunded == "true")
      qry.isRefunded = true;

      if(req.query.isRefunded == "false")
        qry.refundRequest = true;
    }
    
    pipeline.push ({
        $match : {
          isDeleted : false
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
        $match : qry
      },{
        $sort : {
          createdAt : -1
        }
      },{
        $project : {
          _id: 1,
          parent: {
            name : 1,
            email : 1,
            phoneNo : 1,
            dialCode : 1
          },
          bookingStatus: 1,
          refundAmount: 1,
          isRefunded: 1,
          refundDate: 1,
          cancelReason: 1,
          cancelledAt: 1,
          refundStatus: 1
        }
      });

    if (req.query.search) {
      pipeline.push({
        $match: {
          $or: [
            { "parent.name": { $regex: req.query.search, $options: "i" } },
            { "parent.email": { $regex: req.query.search, $options: "i" } },
            { "parent.phone": { $regex: req.query.search, $options: "i" } }
          ]
        }
      });
    }

    pipeline = await common.pagination(pipeline, skip, limit);
    let [booking] = await Model.Booking.aggregate(pipeline);

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      booking: booking.data,
      totalBooking: booking.total
    });
  } catch (error) {
    next(error); 
  } 
};
module.exports.refundPayment = async(req, res, next) => {
  try{
    let lang = req.headers.lang || "en";
    let refundDetail = await Model.Booking.findOne({
      _id : ObjectId(req.params.id),
      isDeleted : false
    }).populate("parentId", "name");

    let confirmationCode = refundDetail.confirmationCode;
    let payment = refundDetail.refundAmount;
    let name = refundDetail.parentId.name;
  
    if(req.body.refundStatus == constants.REFUND_STATUS.ACCEPTED){
         await Model.Booking.findOneAndUpdate({
        _id : ObjectId(req.params.id),
        isDeleted : false
      },{
        $set: {
          refundAmount: payment,
          isRefunded: true,
          refundDate: Date.now(),
          refundRequest: false,
          refundStatus: req.body.refundStatus
        }
      },{
        new : true
      });

      let refund = await cart.refundPayment(confirmationCode, payment, name);
      process.emit("sendNotification", {
        parentId: refundDetail.parentId._id,
        receiverId: refundDetail.parentId._id,
        values: refundDetail,
        role: constants.ROLE.PARENT,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.REFUND_PAYMENT
      });
      return res.success(
      constants.MESSAGES[lang].REFUND_REQUEST_ACCEPTED_SUCCESSFULLY,
      refund
    );
  }

    if(req.body.refundStatus == constants.REFUND_STATUS.REJECTED){
      await Model.Booking.findOneAndUpdate({
        _id : ObjectId(req.params.id),
        isDeleted : false
      },{
        $set: {
          refundAmount: payment,
          isRefunded: false,
          refundDate: Date.now(),
          refundRequest: false,
          refundStatus: req.body.refundStatus,
          refundRejectReason: req.body.refundRejectReason
        }
      },{
        new : true
      });
      process.emit("sendNotification", {
        parentId: refundDetail.parentId._id,
        receiverId: refundDetail.parentId._id,
        values: refundDetail,
        role: constants.ROLE.PARENT,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.REFUND_REJECTED
      });
      return res.success(
        constants.MESSAGES[lang].REFUND_REQUEST_REJECTED_SUCCESSFULLY);
    }
  }catch (error) {
    next(error); 
  } 
};

//Listing
module.exports.subClassList = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [{
        $match: {
          tutorId: ObjectId(req.query.tutorId)
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
    let pipeline = [{
        $match: {
          isDeleted: false,
          isBlocked: false,
          role: constants.APP_ROLE.TUTOR,
          tutorStatus: constants.TUTOR_STATUS.ACCEPTED
        }
      },{
        $project: {
          _id: 1,
          name: 1,
          userName: 1
        }
      }];

    let tutor = await Model.User.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, tutor);
  } catch (error) {
    next(error);
  }
};

//Class
module.exports.addClass = async (req, res, next) => {
  try {
    const lang = req.headers.lang || 'en';
    await Validation.Tutor.addClass.validateAsync(req.body);
    let { promoCodeId, classSlots, tutorId } = req.body;
    let tutor = await Model.User.findById(tutorId);
    
    if(Array.isArray(classSlots) && classSlots.length > 0) {
        const slots = classSlots;
        const slotDates = slots.map(slot => new Date(slot.date));
        const maxDate = new Date(Math.max(...slotDates));
        const minDate = new Date(Math.min(...slotDates));
        req.body.lastDate = maxDate;
        req.body.startDate = minDate;
    }
    
    if(req.body.payment == constants.CLASS_PAYMENT.PER_HOUR){
        let hour = req.body.duration / 60;
        req.body.totalFees = req.body.fees * hour;
    }else if(req.body.payment == constants.CLASS_PAYMENT.SESSION){
        req.body.totalFees = req.body.fees;
    }
    req.body.setting = constants.SETTING.PUBLISH;

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

    const newClass = await Model.Classes.create(req.body);
    
    // Update the class with dyteMeeting data if it exists
    if (req.body.dyteMeeting) {
      await Model.Classes.updateOne(
        { _id: newClass._id },
        { $set: { dyteMeeting: req.body.dyteMeeting } }
      );
      newClass.dyteMeeting = req.body.dyteMeeting;
    }
    
    if (Array.isArray(promoCodeId) && promoCodeId.length > 0) {
      for (let i = 0; i < promoCodeId.length; i++) {
        const promoId = promoCodeId[i];
        await Model.PromoCode.updateOne(
          { _id: promoId, tutorId: req.body.tutorId, isDeleted: false },
          { $addToSet: { classIds: newClass._id } }
        );
      }
    }
    
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
            tutorName: tutor.name,
            className: req.body.topic
          },
          role: constants.ROLE.TUTOR,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.COTUTOR
        });
        process.emit("newClass", {
          tutorId: coTutorId,       
          classId: newClass._id,
          tutorName: tutor.name,
          className: req.body.topic
        });
      });
    }

    // Include dyteMeeting in response if it exists
    const responseData = newClass.toObject();
    if (req.body.dyteMeeting) {
      responseData.dyteMeeting = req.body.dyteMeeting;
    }
    
    return res.success(constants.MESSAGES[lang].SUCCESS, responseData);
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
  
   if(req.query.tutorId){
      qry.tutorId = ObjectId(req.query.tutorId);
    }

   if(req.query.isDelete == "true"){
      qry.isDeleted = true;
    }else{
      qry.isDeleted = false;
    }

    pipeline.push({
        $match: {
          setting: constants.SETTING.PUBLISH,
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
        $lookup: {
          from: "bookings",
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$bookClassId", "$$classId"] }
              }
            },
            { $limit: 1 }
          ],
          as: "userBookings"
        }
      },{
        $lookup: {
          from: "classslots",
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$classId", "$$classId"] },
                status: true,
                date: { $gte: new Date() }  // Only future slots
              }
            },
            {
              $sort: { date: 1, startTime: 1 }  // Earliest future first
            },
            { $limit: 1 }
          ],
          as: "nextSlot"
        }
      },{
        $addFields: {
          isClassBooked: { 
          $gt: [ { $size: { $ifNull: ["$userBookings", []] } }, 0 ] 
        },
        nextSlot: { $arrayElemAt: ["$nextSlot", 0] }
      }
    },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          thumbnail: 1,
          topic: 1,
          description: 1,
          fees: 1,
          seats: 1,
          promocode: 1,
          classMode: 1,
          canBePrivate: 1,
          status: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          grades: 1,
          isFreeLesson: 1,
          typeOfClass: 1,
          payment: 1,
          duration: 1,
          objective: 1,
          isClassBooked: 1,
          allOutcome: 1,
          mostOutcome: 1,
          someOutcome: 1,
          nextSlot: 1,
          "subjects._id": 1,
          "subjects.name": 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "tutor.email": 1,
          "tutor.dialCode": 1,
          "tutor.phoneNo": 1,
          "tutor.userName": 1,
          "tutor.image": 1,
          dyteMeeting: 1
        }
      });

     if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "tutor.name": searchRegex
        },{
          "tutor.email": searchRegex
        },{
          "tutor.phoneNo": searchRegex
        },{
          topic: searchRegex
        },{
          "subjects.name": searchRegex
        }];
      }
    pipeline = await common.pagination(pipeline, skip, limit);
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

    const { addSeats, classSlots, promoCodeId, payment, coTutorId = [], ...updateFields } = req.body;

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

    let tutor = await Model.User.findById(classData.tutorId);

    // Handle slot dates
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      const slotDates = classSlots.map(slot => new Date(slot.date));
      updateFields.startDate = new Date(Math.min(...slotDates));
      updateFields.lastDate = new Date(Math.max(...slotDates));
    }

    // Handle seat increment
    if (addSeats && addSeats > 0) {
      updateFields.seats = classData.seats + addSeats;
      await Model.ClassSlots.updateMany(
        { classId: ObjectId(req.params.id) },
        { $inc: { seats: addSeats, remainingSeats: addSeats } }
      );
    }

    // Handle fee calculation
    if (payment == constants.CLASS_PAYMENT.PER_HOUR) {
      let hour = req.body.duration / 60;
      updateFields.totalFees = req.body.fees * hour;
    } else if (payment == constants.CLASS_PAYMENT.SESSION) {
      updateFields.totalFees = req.body.fees;
    }

    // Update class
    const updatedClass = await Model.Classes.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { $set: updateFields },
      { new: true }
    );

    // Handle promo codes
    if (Array.isArray(promoCodeId) && promoCodeId.length > 0) {
      await Promise.all(
        promoCodeId.map(async promoId => {
          await Model.PromoCode.updateOne(
            { _id: promoId, isDeleted: false },
            { $addToSet: { classIds: ObjectId(req.params.id) } }
          );
        })
      );
    }

    // Handle slots
    if (Array.isArray(classSlots) && classSlots.length > 0) {
      await Model.ClassSlots.deleteMany({ classId: ObjectId(req.params.id) });
      const newSlots = classSlots.map(slot => ({
        ...slot,
        classId: ObjectId(req.params.id),
        tutorId: tutor._id,
        seats: updatedClass.seats,
        remainingSeats: updatedClass.seats,
        timezone: req.body.timezone || "UTC"
      }));
      await Model.ClassSlots.insertMany(newSlots);
    }

    // 🔹 Sync co-tutors
    const existingCoTutors = await Model.ClassCoTutors.find(
      { classId: updatedClass._id },
      { tutorId: 1 }
    ).lean();

    const existingTutorIds = existingCoTutors.map(ct => String(ct.tutorId));
    const newTutorIds = (coTutorId || []).map(id => String(id));

    const tutorsToAdd = newTutorIds.filter(id => !existingTutorIds.includes(id));
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
            tutorName: tutor.name,
            className: updatedClass.topic
          },
          role: constants.ROLE.TUTOR,
          isNotificationSave: true,
          pushType: constants.PUSH_TYPE_KEYS.COTUTOR
        });
      });
    }

    // Remove old co-tutors
    if (tutorsToRemove.length > 0) {
      await Model.ClassCoTutors.deleteMany({
        classId: updatedClass._id,
        tutorId: { $in: tutorsToRemove }
      });
    }

    // Notify remaining co-tutors (not removed, not newly added)
    const notifyTutorIds = newTutorIds.filter(id => !tutorsToAdd.includes(id));
    notifyTutorIds.forEach(tutorId => {
      process.emit("sendNotification", {
        tutorId,
        receiverId: tutorId,
        values: {
          classId: updatedClass._id,
          tutorName: tutor.name,
          className: updatedClass.topic
        },
        role: constants.ROLE.TUTOR,
        isNotificationSave: true,
        pushType: constants.PUSH_TYPE_KEYS.CLASS_UPDATED
      });
    });

    return res.success(constants.MESSAGES[lang].CLASS_DETAILS_UPDATED_SUCCESSFULLY, updatedClass);
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
                  tutorId: "$tutorInfo._id",
                  name: "$tutorInfo.name",
                  profileImage: "$tutorInfo.profileImage"
                  }
                }],
                as: "coTutor"
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
                $expr: {
                  $in: ["$$classId", "$classIds"]
                },
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
      },{
        $project: {
          thumbnail: 1,
          teaser: 1,
          topic: 1,
          description: 1,
          objective: 1,
          fees: 1,
          totalFees: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          grades: 1,  
          isFreeLesson: 1,
          typeOfClass: 1,
          payment: 1,
          duration: 1,                                                                    
          "subjects._id": 1,
          "subjects.name": 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "coTutor.tutorId": 1,
          "coTutor.name": 1,
          "coTutor.userName": 1,
          "coTutor.image": 1,
          promoCodeId: 1,
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
          promoCodes: 1,
          continueFor: 1,
          repeatEvery: 1,
          usdPrice: 1,
          currency: 1,
          endDate: 1,
          dyteMeeting: 1
        }
      });
    let [classes] = await Model.Classes.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, classes);
  } catch (error) {
    next(error);
  }
};

// Get Class Slots by Class ID
module.exports.getClassSlots = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    // Check if class exists
    const classData = await Model.Classes.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false,
      setting: constants.SETTING.PUBLISH
    });

    if (!classData) {
      throw new Error(constants.MESSAGES[lang].CLASS_NOT_FOUND);
    }

    // Get class slots for the specific class
    const classSlots = await Model.ClassSlots.find({
      classId: ObjectId(req.params.id),
      status: true
    }).sort({ date: 1, startTime: 1 });

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      classId: req.params.id,
      totalSlots: classSlots.length,
      classslots: classSlots
    });
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
module.exports.classExport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const user = [];
    let pipeline = [];
    let qry = {};
      if(req.query.status){
      qry.isDeleted = false;
    }

   if(req.query.isDelete == "true"){
      qry.isDeleted = true;
    }else if(req.query.isDelete == "false"){
      qry.isDeleted = false;
    }

    pipeline.push({
        $match: {
          setting: constants.SETTING.PUBLISH,
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
          preserveNullAndEmptyArrays: false
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
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          thumbnail: 1,
          topic: 1,
          description: 1,
          fees: 1,
          seats: 1,
          promocode: 1,
          classMode: 1,
          canBePrivate: 1,
          status: 1,
          "subjects.name": 1,
          "tutor.name": 1,
          "tutor.email": 1,
          "tutor.dialCode": 1,
          "tutor.phoneNo": 1,
          "tutor.userName": 1,
          "tutor.image": 1
        }
      });
    let classes = await Model.Classes.aggregate(pipeline);
    for (const item of classes) {
      user.push({
        Thumbnail: item.thumbnail,
        Name: item.tutor.name,
        DialCode: item.tutor.dialCode,
        PhoneNo: item.tutor.phoneNo,
        Email: item.tutor.email,
        Subject: item.subjects.name,
        Topic: item.topic,
        Seats:  item.seats,
        ClassMode: item.classMode,
        CanBePrivate: item.canBePrivate,
        Promocode: item.promocode
      });
    }
    const csvData = await jsonexport(user);

    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'class.csv',
      Body: csvData
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
      }
      console.log('File uploaded successfully', data.Location);
      res.success({
        message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
        s3Location: data.Location
      });
    });

  } catch (error) {
    next(error);
  }
};
module.exports.classDetails = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    let pipeline = [];
    pipeline.push({
        $match: {
          tutorId: ObjectId(req.query.tutorId),
          setting: constants.SETTING.PUBLISH,
          isDeleted: false
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
          from: "classslots",
          localField: "_id",
          foreignField: "classId",
          as: "slots"
        }
      },{
        $addFields: {
          totalSeats: { $sum: "$slots.seats" },
          totalRemainingSeats: { $sum: "$slots.remainingSeats" }
        }
      },{
        $addFields: {
          fillRate: {
            $cond: [
              { $gt: ["$totalSeats", 0] },
              {
                $multiply: [{
                    $divide: [
                      { $subtract: ["$totalSeats", "$totalRemainingSeats"] },
                      "$totalSeats"
                    ]},
                  100
                ]
              },
              0
            ]}
        }
      },{
        $lookup: {
          from: "classbooks", 
          let: { classId: "$_id" },
          pipeline: [{
              $match: {
                $expr: { $eq: ["$classId", "$$classId"] }
              }
            },{
              $group: {
                _id: "$classId",
                totalClassEarning: { $sum: "$grandTotal" }
              }
            }],
          as: "classEarning"
        }
      },{
        $addFields: {
          totalClassEarning: {
            $ifNull: [{ $arrayElemAt: ["$classEarning.totalClassEarning", 0] }, 0]
          }
        }
      },{
        $sort: { createdAt: -1 }
      },{
        $project: {
          thumbnail: 1,
          topic: 1,
          description: 1,
          fees: 1,
          totalFees: 1,
          seats: 1,
          classMode: 1,
          canBePrivate: 1,
          status: 1,
          classId: 1,
          isFreeLesson: 1,
          typeOfClass: 1,
          payment: 1,
          duration: 1,
          "subjects._id": 1,
          "subjects.name": 1,
          fillRate: 1,
          totalClassEarning: 1,
          createdAt: 1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    const [classes] = await Model.Classes.aggregate(pipeline);

    const totalEarningResult = await Model.Booking.aggregate([
      {
        $match: {
          tutorId: ObjectId(req.query.tutorId),
          bookType: constants.BOOK_TYPE.CLASS
        }
      },{
        $group: {
          _id: null,
          totalEarning: { $sum: "$grandTotal" }
        }
      }
    ]);
    const totalEarning = totalEarningResult[0]?.totalEarning || 0;
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      classes,
      totalEarning
    });
  } catch (error) {
    next(error);
  }
};

//Promo Code
module.exports.addPromoCode = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addPromoCode.validateAsync(req.body);

    let codeName = req.body.codeName;
    let tutor = await Model.User.findById(req.body.tutorId);
    if (codeName) {
      const existingPromo = await Model.PromoCode.findOne({
        codeName: { $regex: new RegExp(`^${codeName.trim()}$`, "i") },
        tutorId: req.body.tutorId,
        isDeleted: false
      });
      if (existingPromo) {
        throw new Error(constants.MESSAGES[lang].PROMO_NAME_EXISTS);
      }
    } else {
      let unique = false;
      while (!unique) {
        const generated = functions.generatePromoCodeName(tutor.userName);
        const exists = await Model.PromoCode.findOne({
          codeName: generated,
          tutorId: req.body.tutorId,
          isDeleted: false
        });
        if (!exists) {
          codeName = generated;
          unique = true;
        }
      }
    }
    req.body.codeName = codeName;
    req.body.remainingCount = req.body.maxUser;
    req.body.setting = constants.SETTING.PUBLISH;
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

   if(req.query.status){
      qry.setting = constants.SETTING.PUBLISH;
    }

   if(req.query.isDelete == "true"){
      qry.isDeleted = true;
    }else{
      qry.isDeleted = false;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          name: searchRegex
        },{
          codeName: searchRegex
        },{
          "tutor.name": searchRegex
        },{
          "tutor.email": searchRegex
        },{
          "tutor.userName": searchRegex
        }];
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
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          name: 1,
          codeName: 1,
          discountType: 1,
          discount: 1,
          maxUsers: 1,
          usedCount: 1,
          type: 1,
          startDate: 1,
          expiryDate: 1,
          createdAt: 1,
          status: 1,
          allClasses: 1,
          classIds: 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "tutor.email": 1,
          "tutor.dialCode": 1,
          "tutor.phoneNo": 1,
          "tutor.userName": 1,
          "tutor.image": 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [promoCode] = await Model.PromoCode.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promoCode);
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
      isDeleted: false
    });
    if (!promocode) {
      throw new Error(constants.MESSAGES[lang].PROMOCODE_NOT_FOUND);
    }
    if (req.body.codeName && req.body.codeName.trim()) {
      const duplicateName = await Model.PromoCode.findOne({
        _id: { $ne: promoId },
        codeName: { $regex: new RegExp(`^${req.body.codeName.trim()}$`, "i") },
        tutorId: req.body.tutorId,
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
    if (req.body.addMaxUser && req.body.addMaxUser > 0) {
      req.body.maxUser = promocode.maxUser + req.body.addMaxUser;
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
        $project: {
          name: 1,
          codeName: 1,
          discountType: 1,
          discount: 1,
          maxUser: 1,
          usedCount: 1,
          type: 1,
          startDate: 1,
          expiryDate: 1,
          createdAt: 1,
          status: 1,
          allClasses: 1,
          classIds: 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "tutor.email": 1,
          "tutor.dialCode": 1,
          "tutor.phoneNo": 1,
          "tutor.userName": 1,
          "tutor.image": 1
        }
      });
    let [promocode] = await Model.PromoCode.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, promocode);
  } catch (error) {
    next(error);
  }
};
module.exports.deletePromoCode = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const classData = await Model.PromoCode.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!classData) {
      throw new Error(constants.MESSAGES[lang].PROMOCODE_NOT_FOUND);
    }
    const doc = await Model.PromoCode.findOneAndUpdate(
      { _id: ObjectId(req.params.id) },
      { isDeleted: true },
      { new: true }
    );
    return res.success(
      constants.MESSAGES[lang].PROMOCODE_DELETED_SUCCESSFULLY,
      doc
    );
  } catch (error) {
    next(error);
  }
};
module.exports.promocodeExport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const user = [];
    let pipeline = [];
    let qry = {};
      if(req.query.status){
      qry.isDeleted = false;
    }

   if(req.query.isDelete == "true"){
      qry.isDeleted = true;
    }else if(req.query.isDelete == "false"){
      qry.isDeleted = false;
    }

    pipeline.push({
        $match: {
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
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
         name: 1,
          discount: 1,
          codes: 1,
          expiryDate: 1,
          createdAt: 1,
          status: 1,
          "tutor._id": 1,
          "tutor.name": 1,
          "tutor.email": 1,
          "tutor.dialCode": 1,
          "tutor.phoneNo": 1,
          "tutor.userName": 1,
          "tutor.image": 1
        }
      });
    let promoCode = await Model.PromoCode.aggregate(pipeline);
    for (const item of promoCode) {
      user.push({
        Code: item.name,
        Discount: item.discount,
        Codes: item.codes,
        ExpiryDate: item.expiryDate,
        Name: item.tutor.name,
        Email: item.tutor.email,
        CreatedAt: item.CreatedAt,
        status: item.status
      });
    }
    const csvData = await jsonexport(user);

    const s3 = new aws.S3({
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    });
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: 'promocode.csv',
      Body: csvData
    };

    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        return new Error(constants.MESSAGES[lang].FILE_NOT_UPLOADED);
      }
      console.log('File uploaded successfully', data.Location);
      res.success({
        message: constants.MESSAGES[lang].FILE_UPLOADED_SUCCESSFULLY,
        s3Location: data.Location
      });
    });

  } catch (error) {
    next(error);
  }
};

//Content
module.exports.createContent = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Tutor.addContent.validateAsync(req.body);
    const content = await Model.Content.create(req.body);
    return res.success(constants.MESSAGES[lang].CONTENT_CREATED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.getContent = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};

    if(req.query.createdBy){
      qry.createdBy = Number(req.query.createdBy);
    }

    if(req.query.contentType){
      qry.contentType = Number(req.query.contentType);
    }

    if(req.query.userId){
      qry.userId = ObjectId(req.query.userId);
    }

    qry.setting = constants.SETTING.PUBLISH;

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "user.name": searchRegex
        },{
          "user.email": searchRegex
        },{
          "user.phoneNo": searchRegex
        },{
          "subjects.name": searchRegex
        },{
          title: searchRegex
        },{
          topic: searchRegex
        }];
      }

    pipeline.push({
        $match: {
          isDeleted: false
        }
      },{
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
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          images: 1,
          topic: 1,
          title: 1,
          description: 1,
          "category._id": 1,
          "category.name": 1,
          "subjects._id": 1,
          "subjects.name": 1,
          gradeId: 1,
          language: 1,
          views: 1,
          contentType: 1,
          createdAt: 1,
          createdBy: 1,
          status: 1,
          allowComments: 1,
          visibility: 1,
          isAnonymous: 1,
          upVoteCount: 1,
          downVoteCount: 1,
          likeCount: 1,
          commentCount: 1,
          shareCount: 1,
          saveCount: 1,
          "user._id": 1,
          "user.name": 1,
          "user.email": 1,
          "user.dialCode": 1,
          "user.phoneNo": 1,
          "user.userName": 1,
          "user.image": 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [content] = await Model.Content.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.getContentById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
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
        $project: {
          images: 1,
          topic: 1,
          title: 1,
          description: 1,
          gradeId: 1,
          "category._id": 1,
          "category.name": 1,
          "subjects._id": 1,
          "subjects.name": 1,
          language: 1,
          views: 1,
          createdAt: 1,
          createdBy: 1,
          status: 1,
          allowComments: 1,
          visibility: 1,
          isAnonymous: 1,
          "user._id": 1,
          "user.name": 1,
          "user.email": 1,
          "user.dialCode": 1,
          "user.phoneNo": 1,
          "user.userName": 1,
          "user.image": 1
        }
      });
    let [content] = await Model.Content.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, content);
  } catch (error) {
    next(error);
  }
};
module.exports.updateContent = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Tutor.updateContent.validateAsync(req.body);

    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("No IDs provided");
    }
    let update = {};
    switch (req.body.type) {
      case constants.BULK_STATUS.DELETE:
        update = { $set: { isDeleted: true } };
        break;
      case constants.BULK_STATUS.UPDATE:
        update = { $set: req.body };
        break;
      default:
        throw new Error("Invalid status provided");
    }
    await Model.Content.updateMany(
      { _id: { $in: ids.map(id => ObjectId(id)) }, isDeleted: false },
      update
    );
    return res.success(
      constants.MESSAGES[lang].CONTENT_UPDATED_SUCCESSFULLY,
      {}
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
module.exports.contentDetails = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const matchQuery = {
      userId: ObjectId(req.query.userId),
      contentType: Number(req.query.contentType),
      isDeleted: false
    };

    const totalCount = await Model.Content.countDocuments(matchQuery);
    const result = await Model.Content.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" }
        }
      }
    ]);
    const totalViews = result[0]?.totalViews || 0;
    return res.success(
      constants.MESSAGES[lang].CONTENT_FETCHED_SUCCESSFULLY, 
      {
        total: totalCount,
        approved: approvedCount,
        rejected: rejectedCount,
        views: totalViews
      }
    );
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
          "tutor.email": 1,
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          name: 1,
          email: 1,
          type: 1,
          status: 1,
          other: 1,
          createdAt: 1,
          revert: 1,
          tutorRevert: 1
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
    let findInquiry = await Model.Inquiry.findById(req.body.inquiryId);
    findInquiry.revert = req.body.revert;
    findInquiry.status = constants.INQUIRY_STATUS.ACCEPTED;
    findInquiry.save();
    const inquiryTypeName = Object.keys(constants.INQUIRY_TYPE).find(
      key => constants.INQUIRY_TYPE[key] === findInquiry.type
    );
    let tutor = await Model.User.findById(findInquiry.tutorId);
    let parent = await Model.User.findById(findInquiry.parentId);

     if(req.body.type == constants.INQUIRY_REVERT.REVERT){
      if(findInquiry.isGuest){
         let payload = {
          email: findInquiry.email.toLowerCase(),
          parentName: findInquiry.name,
          tutorName: tutor.name,
          revert: req.body.revert,
          type: inquiryTypeName,
          other: findInquiry.other
        };
        services.EmalService.inquiryGuest(payload);
      }
    }else if(req.body.type == constants.INQUIRY_REVERT.FORWARD){
      findInquiry.isForward = true;
      let payload = {
        email: tutor.email.toLowerCase(),
        tutorName: tutor.name ? tutor.name: tutor.email,
        parentName: parent.name,
        parentEmail: parent.email,
        type: inquiryTypeName,
        other: findInquiry.other
      };
      services.EmalService.inquiry(payload);
    }
    findInquiry.save();
    return res.success(constants.MESSAGES[lang].REVERT_FOR_INQUIRY, findInquiry);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteInquiry = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const inquiry = await Model.Inquiry.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!inquiry) {
      throw new Error(constants.MESSAGES[lang].INQUIRY_NOT_FOUND);
    }
    inquiry.isDeleted = true;
    inquiry.save();
    return res.success(
      constants.MESSAGES[lang].INQUIRY_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};

//Banner
module.exports.addBanner = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addBanner.validateAsync(req.body);
    
    const banner = await Model.Banner.create(req.body);
    return res.success(constants.MESSAGES[lang].BANNER_ADDED_SUCCESSFULLY, banner);
  } catch (error) {
    next(error);
  }
};
module.exports.getBanner = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];

    pipeline.push({
      $match: {
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
          image: 1,
          buttonText: 1,
          createdAt: 1,
          status: 1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    let [banner] = await Model.Banner.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, banner);
  } catch (error) {
    next(error);
  }
};
module.exports.updateBanner = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    await Validation.Admin.addBanner.validateAsync(req.body);

    const bannerId = ObjectId(req.params.id);

    const banner = await Model.Banner.findOne({
      _id: bannerId,
      isDeleted: false
    });

    if (!banner) {
      throw new Error(constants.MESSAGES[lang].BANNER_NOT_FOUND);
    }

    const updatedBanner = await Model.Banner.findOneAndUpdate(
      { _id: bannerId },
      { $set: req.body },
      { new: true }
    );

    if (req.body.status == true) {
      await Model.Banner.updateMany(
        { _id: { $ne: bannerId } }, 
        { $set: { status: false } }
      );
    }

    return res.success(
      constants.MESSAGES[lang].BANNER_UPDATED_SUCCESSFULLY,
      updatedBanner
    );
  } catch (error) {
    next(error);
  }
};
module.exports.getBannerById = async (req, res, next) => {
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
module.exports.deleteBanner = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const banner = await Model.Banner.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!banner) {
      throw new Error(constants.MESSAGES[lang].BANNER_NOT_FOUND);
    }

    const isActive = banner.status === true;

    banner.isDeleted = true;
    banner.status = false;
    await banner.save();

    if (isActive) {
      const latestBanner = await Model.Banner.findOne({
        _id: { $ne: banner._id },
        isDeleted: false
      }).sort({ createdAt: -1 });

      if (latestBanner) {
        latestBanner.status = true;
        await latestBanner.save();
      }
    }
    return res.success(constants.MESSAGES[lang].BANNER_DELETED_SUCCESSFULLY);
  } catch (error) {
    next(error);
  }
};

//Category
module.exports.addCategory = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addCategory.validateAsync(req.body);

    const nameRegex = new RegExp("^" + req.body.name.trim() + "$", "i");

    const existingCategory = await Model.Category.findOne({
      name: { $regex: nameRegex },
      isDeleted: false 
    });

    if (existingCategory) throw new Error(constants.MESSAGES[lang].CATEGORY_EXISTS);
    
    const category = await Model.Category.create(req.body);
    return res.success(constants.MESSAGES[lang].CATEGORY_ADDED_SUCCESSFULLY, category);
  } catch (error) {
    next(error);
  }
};
module.exports.getCategory = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          name: searchRegex
        }];
      }

    pipeline.push({
      $match: {
        isDeleted: false,
        ...qry
      }
    },{
        $sort: {
          createdAt: -1
        }
    },{
        $project: {
          name: 1,
          createdAt: 1,
          status: 1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    let [category] = await Model.Category.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, category);
  } catch (error) {
    next(error);
  }
};
module.exports.updateCategory = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addCategory.validateAsync(req.body);

    const categoryId = ObjectId(req.params.id);

    const category = await Model.Category.findOne({
      _id: categoryId,
      isDeleted: false
    });

    if (!category) {
      throw new Error(constants.MESSAGES[lang].CATEGORY_NOT_FOUND);
    }

   if(req.body.name){
     const nameRegex = new RegExp("^" + req.body.name.trim() + "$", "i");
     const existingCategory = await Model.Category.findOne({
      _id: { $ne: categoryId },
      name: { $regex: nameRegex },
      isDeleted: false
    });
    if (existingCategory) throw new Error(constants.MESSAGES[lang].CATEGORY_EXISTS);
   }
    
    const updatedCategory = await Model.Category.findOneAndUpdate(
      { _id: categoryId },
      { $set: req.body },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].CATEGORY_UPDATED_SUCCESSFULLY,
      updatedCategory
    );
  } catch (error) {
    next(error);
  }
};
module.exports.getCategoryById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
        $project: {
          name: 1,
          createdAt: 1,
          status: 1
        }
      });
    let [category] = await Model.Category.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, category);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteCategory = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const category = await Model.Category.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!category) {
      throw new Error(constants.MESSAGES[lang].CATEGORY_NOT_FOUND);
    }

    category.isDeleted = true;
    await category.save();

    return res.success(constants.MESSAGES[lang].CATEGORY_DELETED_SUCCESSFULLY);
  } catch (error) {
    next(error);
  }
};

//Subjects
module.exports.addSubject = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addSubject.validateAsync(req.body);

    const nameRegex = new RegExp("^" + req.body.name.trim() + "$", "i");

    const existingSubject = await Model.Subjects.findOne({
      name: { $regex: nameRegex },
      isDeleted: false 
    });

    if (existingSubject) throw new Error(constants.MESSAGES[lang].SUBJECT_EXISTS);
    
    const subject = await Model.Subjects.create(req.body);
    return res.success(constants.MESSAGES[lang].SUBJECT_ADDED_SUCCESSFULLY, subject);
  } catch (error) {
    next(error);
  }
};
module.exports.getSubject = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = Number((page - 1) * limit);
    let pipeline = [];
    let qry = {};

    if(req.query.categoryId){
      qry.categoryId = ObjectId(req.query.categoryId);
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          name: searchRegex
        }];
    }

    pipeline.push({
      $match: {
        isDeleted: false,
        ...qry
      }
    },{
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
        $sort: {
          createdAt: -1
        }
      },{
        $project: {
          name: 1,
          "category._id": 1,
          "category.name": 1,
          createdAt: 1,
          status: 1
        }
      });

    pipeline = await common.pagination(pipeline, skip, limit);
    let [subject] = await Model.Subjects.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, subject);
  } catch (error) {
    next(error);
  }
};
module.exports.getSubjectById = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let pipeline = [];

    pipeline.push({
        $match: {
           _id: ObjectId(req.params.id)
        }
      },{
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
        $project: {
          name: 1,
          "category._id": 1,
          "category.name": 1,
          createdAt: 1,
          status: 1
        }
      });
    let [subject] = await Model.Subjects.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, subject);
  } catch (error) {
    next(error);
  }
};
module.exports.updateSubject = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.addSubject.validateAsync(req.body);

    const subjectId = ObjectId(req.params.id);

    const subject = await Model.Subjects.findOne({
      _id: subjectId,
      isDeleted: false
    });

    if (!subject) {
      throw new Error(constants.MESSAGES[lang].SUBJECT_NOT_FOUND);
    }
    
    if(req.body.name){
    const nameRegex = new RegExp("^" + req.body.name.trim() + "$", "i");
    const existingSubject = await Model.Subjects.findOne({
      _id: { $ne: subjectId },
      name: { $regex: nameRegex },
      isDeleted: false
    });

    if (existingSubject) throw new Error(constants.MESSAGES[lang].SUBJECT_EXISTS);
    }

    const updatedSubject = await Model.Subjects.findOneAndUpdate(
      { _id: subjectId },
      { $set: req.body },
      { new: true }
    );

    return res.success(
      constants.MESSAGES[lang].SUBJECT_UPDATED_SUCCESSFULLY,
      updatedSubject
    );
  } catch (error) {
    next(error);
  }
};
module.exports.deleteSubject = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    const subject = await Model.Subjects.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });

    if (!subject) {
      throw new Error(constants.MESSAGES[lang].SUBJECT_NOT_FOUND);
    }

    subject.isDeleted = true;
    await subject.save();

    return res.success(constants.MESSAGES[lang].SUBJECT_DELETED_SUCCESSFULLY);
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
    let search = req.query.search ? new RegExp(req.query.search, "i") : null;

    switch (type) {
      case constants.LISTING.CATEGORY:
        data = await Model.Category.find({
          isDeleted: false,
          status: true,
          ...(search ? { name: { $regex: search } } : {})
        }).select("name");
        break;

      case constants.LISTING.SUBJECT:
        if (req.query.categoryId) {
          qry.categoryId = ObjectId(req.query.categoryId);
        }

        data = await Model.Subjects.find({
          isDeleted: false,
          status: true,
          ...qry,
          ...(search ? { name: { $regex: search } } : {})
        }).select("name");
        break;

      case constants.LISTING.TUTOR_SUBJECT:{
         const teachingDetail = await Model.TeachingDetails.findOne({
          tutorId: ObjectId(req.query.tutorId)
        });

        data = await Model.Subjects.find({
          _id: { $in: teachingDetail.subjectIds },
          isDeleted: false,
          status: true,
          ...(search ? { name: { $regex: search } } : {})
        }).select("name");
        break;
      }
       

      case constants.LISTING.PROMOCODE: {
        if (req.query.tutorId) {
          qry.tutorId = ObjectId(req.query.tutorId);
        }
        if (req.query.promoType) {
          qry.type = Number(req.query.promoType);
        }
        const now = new Date();

        data = await Model.PromoCode.find({
          isDeleted: false,
          status: true,
          expiryDate: { $gte: now },
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } }
          ],
          ...qry,
          ...(search ? { $or: [{ name: { $regex: search } }, { codeName: { $regex: search } }] } : {})
        }).select("name codeName discount maxUser usedCount");
        break;
      }
        
      case constants.LISTING.CLASS:
        if (req.query.tutorId) {
          qry.tutorId = ObjectId(req.query.tutorId);
        }
        if (req.query.canBePrivate == "true") {
          qry.canBePrivate = true;
        } else if (req.query.canBePrivate == "false") {
          qry.canBePrivate = false;
        }

        data = await Model.Classes.find({
          isDeleted: false,
          status: true,
          isFreeLesson: false,
          setting: constants.SETTING.PUBLISH,
          ...qry,
          ...(search ? { topic: { $regex: search } } : {})
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

//Booked Classes
module.exports.getBookedClasses = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

   let qry = {};

   if(req.query.tutorId){
    qry.tutorId = ObjectId(req.query.tutorId);
   }

    if(req.query.classId){
    qry.bookClassId = ObjectId(req.query.classId);
   }

   if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), "i");
      qry.$or = [{
          "tutor.name": searchRegex
        },{
          "tutor.email": searchRegex
        },{
          "parent.name": searchRegex
        },{
          "parent.email": searchRegex
        },{
          "subjectId.name": searchRegex
        },{
          "classData.topic": searchRegex
        },{
          bookingNumber: searchRegex
        }];
      }
    let pipeline = [{
      $match: {
        bookType: constants.BOOK_TYPE.CLASS
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
        $match: qry
      },{
        $sort: { createdAt: -1 }
      },{
        $project: {
          tutor: { _id: 1, name: 1, image: 1, userName: 1, email: 1, dialCode: 1, phoneNo: 1 },
          parent: { _id: 1, name: 1, image: 1, email: 1, dialCode: 1, phoneNo: 1 },
          subjectId: { name: 1 },
          createdAt: 1,
          grandTotal: 1,
          classModeOnline: 1,
          tutorMoney: 1,
          serviceType: 1,
          serviceCharges: 1,
          address: 1,
          bookingNumber: 1,
          classData: {
            _id: 1,
            topic: 1,
            description: 1,
            thumbnail: 1,
            fees: 1,
            language: 1,
            address: 1,
            grades: 1
          }
        }
      }];

    pipeline = await common.pagination(pipeline, skip, limit);
    let [booking] = await Model.Booking.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      booking: booking.data,
      totalBooking: booking.total
    });
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
      }, {
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
          parent: { _id: 1, name: 1, image: 1, email: 1, dialCode: 1, phoneNo: 1 },
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

//Content Report 
module.exports.getContentReport = async (req, res, next) => {
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
        $lookup: {
          from: "contents",
          localField: "contentId",
          foreignField: "_id",
          as: "content"
        }
      },{
        $unwind: {
          path: "$content",
          preserveNullAndEmptyArrays: true
        }
      },{
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
          "tutor.email": 1,
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          "content._id": 1,
          "content.title": 1,
          "content.topic": 1,
          "content.description": 1,
          "content.contentType": 1,
          report: 1,
          revert: 1,
          reason: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [report] = await Model.ReportContent.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, report);
  } catch (error) {
    next(error);
  }
};
module.exports.contentReportRevert = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.contentRevert.validateAsync(req.body);

    let findReport = await Model.ReportContent.findById(req.body.reportId);
    let parent = await Model.User.findById(findReport.parentId);
    const content = await Model.Content.findById(findReport.contentId);
    const tutor = await Model.User.findById(content.userId);
    findReport.status = constants.INQUIRY_STATUS.ACCEPTED;
    findReport.revert = req.body.revert;
    await findReport.save();
    
    const reportReasonLabel = Object.keys(constants.REPORT).find(
      key => constants.REPORT[key] === findReport.report
    );
    let payload = {
      email: parent.email.toLowerCase(),
      parentName: parent.name ? parent.name : parent.email,
      tutorName: tutor?.name ? tutor.name : tutor?.email,
      report: reportReasonLabel,
      reason: findReport.reason,
      revert: findReport.revert
    };

    services.EmalService.contentReport(payload);
    return res.success(constants.MESSAGES[lang].REVERT_FOR_REPORT, findReport);
  } catch (error) {
    next(error);
  }
};

module.exports.deleteContentReport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const report = await Model.ReportContent.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!report) {
      throw new Error(constants.MESSAGES[lang].REPORT_NOT_FOUND);
    }

    report.isDeleted = true;
    report.save();

    return res.success(
      constants.MESSAGES[lang].REPORT_DELETED_SUCCESSFULLY,
      {}
    );
  } catch (error) {
    next(error);
  }
};

//Tutor Report
module.exports.getTutorReport = async (req, res, next) => {
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
          "tutor._id": 1,
          "tutor.image": 1,
          "tutor.name": 1,
          "tutor.userName": 1,
          "tutor.email": 1,
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          report: 1,
          revert: 1,
          reason: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [report] = await Model.ReportTutor.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, report);
  } catch (error) {
    next(error);
  }
};
module.exports.tutorReportRevert = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.contentRevert.validateAsync(req.body);
    let findReport = await Model.ReportTutor.findById(req.body.reportId);
    let tutor =  await Model.User.findById(findReport.tutorId);
    let parent = await Model.User.findById(findReport.parentId);
    findReport.status = constants.INQUIRY_STATUS.ACCEPTED;
    findReport.revert = req.body.revert;
    findReport.save();
     let payload = {
      email: parent.email.toLowerCase(),
      parentName: parent.name ? parent.name: parent.email,
      tutorName: tutor.name ? tutor.name: "",
      reason: findReport.reason,
      revert: findReport.revert
    };
    services.EmalService.tutorReport(payload);
    return res.success(constants.MESSAGES[lang].REVERT_FOR_REPORT, findReport);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteTutorReport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const report = await Model.ReportTutor.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!report) {
      throw new Error(constants.MESSAGES[lang].REPORT_NOT_FOUND);
    }
    report.isDeleted = true;
    report.save();
    return res.success(
      constants.MESSAGES[lang].REPORT_DELETED_SUCCESSFULLY, {});
  } catch (error) {
    next(error);
  }
};

//Chat Report
module.exports.getChatReport = async (req, res, next) => {
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
          "tutor.email": 1,
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          chatId: 1,
          reportBy: 1,
          report: 1,
          screenshot: 1,
          details: 1,
          revert: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [report] = await Model.ReportChat.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, report);
  } catch (error) {
    next(error);
  }
};
module.exports.chatReportRevert = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.contentRevert.validateAsync(req.body);
    let findReport = await Model.ReportChat.findById(req.body.reportId);
    let tutor =  await Model.User.findById(findReport.tutorId);
    let parent = await Model.User.findById(findReport.parentId);
    findReport.status = constants.INQUIRY_STATUS.ACCEPTED;
    findReport.revert = req.body.revert;
    findReport.save();

    const reportEnumKey = Object.keys(constants.REPORT).find(
      key => constants.REPORT[key] === findReport.report
    );
     let payload = {
      email: parent.email.toLowerCase(),
      parentName: parent.name ? parent.name: parent.email,
      tutorName: tutor.name ? tutor.name: "",
      reason: reportEnumKey,
      revert: findReport.revert
    };
    services.EmalService.tutorReport(payload);
    return res.success(constants.MESSAGES[lang].REVERT_FOR_REPORT, findReport);
  } catch (error) {
    next(error);
  }
};
module.exports.deleteChatReport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const report = await Model.ReportChat.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!report) {
      throw new Error(constants.MESSAGES[lang].REPORT_NOT_FOUND);
    }
    report.isDeleted = true;
    report.save();
    return res.success(
      constants.MESSAGES[lang].REPORT_DELETED_SUCCESSFULLY, {});
  } catch (error) {
    next(error);
  }
};

module.exports.chat = async (req, res, next) => {
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
    let pipeline = [{
        $match: {
          connectionId: req.params.id
        }
      },{
        "$lookup": {
          "from": "users",
          "let": {
            "tutorId": "$tutorId"
          },
          "pipeline": [{
              "$match": {
                "$expr": {
                  "$eq": ["$_id", "$$tutorId"]
                }
              }
            },{
              "$project": {
                name: 1,
                image: 1,
                phoneNo: 1,
                email: 1
              }
            }
          ],
          "as": "tutorId"
        }
      }, {
        "$lookup": {
          "from": "users",
          "let": {
            "parentId": "$parentId"
          },
          "pipeline": [{
              "$match": {
                "$expr": {
                  "$eq": ["$_id", "$$parentId"]
                }
              }
            },{
              "$project": {
                name: 1,
                imag: 1,
                phoneNo: 1,
                email: 1
              }
            }
          ],
          "as": "parentId"
        }
      }, {
        "$unwind": "$parentId"
      }, {
        "$unwind": "$tutorId"
      }, {
        "$lookup": {
          "from": "bookings",
          "let": {
            "bookingId": "$bookingId"
          },
          "pipeline": [{
            "$match": {
              "$expr": {
                "$eq": ["$$bookingId", "$_id"]
              }
            }
          }, {
            "$project": {
              bookingStatus: 1
            }
          }],
          "as": "bookings"
        }
      },{
        $unwind: {
            path: "$bookings",
            preserveNullAndEmptyArrays: true
          }
      },{
        $match: qry
      },{
        $sort: {
          createdAt: -1
        }
      }];
    pipeline = await common.pagination(pipeline, skip, limit);
    let [chating] = await Model.ChatMessage.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      message: chating.data,
      totalmessage: chating.total
    });

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

//Class Report
module.exports.getClassReport = async (req, res, next) => {
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
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classId"
        }
      },{
        $unwind: {
          path: "$classId",
          preserveNullAndEmptyArrays: true
        }
      },{  
          $sort: {
            createdAt: -1
        }
      },{
        $project: {
          "classId._id": 1,
          "classId.topic": 1,
          "classId.description": 1,
          "parent.image": 1,
          "parent.name": 1,
          "parent.email": 1,
          revert: 1,
          reason: 1,
          report: 1,
          createdAt: 1
        }
      });
    pipeline = await common.pagination(pipeline, skip, limit);
    let [report] = await Model.ReportClass.aggregate(pipeline);
    return res.success(constants.MESSAGES[lang].DATA_FETCHED, report);
  } catch (error) {
    next(error);
  }
};
module.exports.classReportRevert = async (req, res, next) => {
  try {
    const lang = req.headers.lang || "en";
    await Validation.Admin.contentRevert.validateAsync(req.body);
    let findReport = await Model.ReportClass.findById(req.body.reportId);
    let parent =  await Model.User.findById(findReport.parentId);
    let classes = await Model.Classes.findById(findReport.classId);
    findReport.status = constants.INQUIRY_STATUS.ACCEPTED;
    findReport.revert = req.body.revert;
    findReport.save();
    const REPORT_LABELS = Object.fromEntries(
      Object.entries(constants.REPORT).map(([k, v]) => [v, k.replace(/_/g, " ")])
    );

    let payload = {
      email: parent.email.toLowerCase(),
      parentName: parent.name ? parent.name : parent.email,
      classTopic: classes.topic ? classes.topic : "",
      report: REPORT_LABELS[findReport.report] || "",
      reason: findReport.reason,
      revert: findReport.revert
    };
    services.EmalService.classReport(payload);
    return res.success(constants.MESSAGES[lang].REVERT_FOR_REPORT, findReport);
  } catch (error) {
    next(error);
  }
};

module.exports.getReports = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    let page = req.query.page ? Number(req.query.page) : 1;
    let limit = req.query.limit ? Number(req.query.limit) : 10;
    let skip = (page - 1) * limit;

    let pipeline = [
      {
        $lookup: {
          from: "reportchats",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentId", "$$parentId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            },
            { $addFields: { reportType: "ReportChat" } }
          ],
          as: "ReportChat"
        }
      },
      {
        $lookup: {
          from: "reportclasses",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentId", "$$parentId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            },
            { $addFields: { reportType: "ReportClass" } }
          ],
          as: "ReportClass"
        }
      },
      {
        $lookup: {
          from: "reporttutors",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentId", "$$parentId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            },
            { $addFields: { reportType: "ReportTutor" } }
          ],
          as: "ReportTutor"
        }
      },
      {
        $lookup: {
          from: "reportcontents",
          let: { parentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentId", "$$parentId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            },
            { $addFields: { reportType: "ReportContent" } }
          ],
          as: "ReportContent"
        }
      },
      {
        $addFields: {
          combined: {
            $concatArrays: [
              "$ReportChat",
              "$ReportClass",
              "$ReportTutor",
              "$ReportContent"
            ]
          }
        }
      },
      { $unwind: "$combined" },
      {
        $replaceRoot: {
          newRoot: { $mergeObjects: ["$combined", "$$ROOT"] }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "parentId",
          foreignField: "_id",
          as: "parent"
        }
      },
      { $unwind: { path: "$parent", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "tutorId",
          foreignField: "_id",
          as: "tutor"
        }
      },
      { $unwind: { path: "$tutor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "contents",
          localField: "contentId",
          foreignField: "_id",
          as: "content"
        }
      },
      { $unwind: { path: "$content", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classId"
        }
      },
      { $unwind: { path: "$classId", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          reportId: "$combined._id",
          reportType: 1,
          chatId: 1,
          content: 1,
          classId: 1,
          reason: 1,
          report: 1,
          revert: 1,
          status: 1,
          createdAt: "$combined.createdAt",
          parent: { name: 1, email: 1, _id: 1 },
          tutor: { name: 1, email: 1, _id: 1 }
        }
      },{
        $sort : {
          createdAt: -1
        }
      }
    ];

    if (req.query.status) {
      pipeline.push({ $match: { status: Number(req.query.status) } });
    }
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline = await common.pagination(pipeline, skip, limit);
    let report = await Model.User.aggregate(pipeline);
    let total = report[0]?.total || 0;
    let data = report[0]?.data || [];

    return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
      total,
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports.reportsCount = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";

    let tutorReportCount = await Model.ReportTutor.countDocuments({
      isDeleted: false
    });

    let chatReportCount = await Model.ReportChat.countDocuments({
      isDeleted: false
    });

    let classReportCount = await Model.ReportClass.countDocuments({
      isDeleted: false
    });

    // Report counts grouped by contentType
    let contentReports = await Model.ReportContent.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: "contents",
          localField: "contentId",
          foreignField: "_id",
          as: "content"
        }
      },
      { $unwind: { path: "$content", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$content.contentType",
          count: { $sum: 1 }
        }
      }
    ]);

    // Map results into structured counts
    let forumReportCount = 0;
    let shortVideoReportCount = 0;
    let teaserVideoReportCount = 0;
    let postReportCount = 0;

    contentReports.forEach(r => {
      switch (r._id) {
        case constants.CONTENT_TYPE.FORUM:
          forumReportCount = r.count;
          break;
        case constants.CONTENT_TYPE.SHORT_VIDEO:
          shortVideoReportCount = r.count;
          break;
        case constants.CONTENT_TYPE.TEASER_VIDEO:
          teaserVideoReportCount = r.count;
          break;
        case constants.CONTENT_TYPE.POST:
          postReportCount = r.count;
          break;
        default: 
        break;
      }
    });

    return res.success(constants.MESSAGES[lang].REPORT_DELETED_SUCCESSFULLY, {
      tutorReportCount,
      chatReportCount,
      classReportCount,
      forumReportCount,
      shortVideoReportCount,
      teaserVideoReportCount,
      postReportCount
    });
  } catch (error) {
    next(error);
  }
};

// Meeting Analytics - Re-use from Webhook controllers
module.exports.getMeetingAnalytics = require('../WebhookController/MeetingAnalytics').getMeetingAnalytics;
module.exports.getChatAnalytics = require('../WebhookController/ChatAnalytics').getChatAnalytics;

module.exports.deleteClassReport = async (req, res, next) => {
  try {
    let lang = req.headers.lang || "en";
    const report = await Model.ReportClass.findOne({
      _id: ObjectId(req.params.id),
      isDeleted: false
    });
    if (!report) {
      throw new Error(constants.MESSAGES[lang].REPORT_NOT_FOUND);
    }
    report.isDeleted = true;
    report.save();
    return res.success(
      constants.MESSAGES[lang].REPORT_DELETED_SUCCESSFULLY, {});
  } catch (error) {
    next(error);
  }
};

module.exports.getClassRevenue = async (req, res, next) => {
  try {
    const classId = req.params.classId; 
    if (!classId) {
      return res.status(400).json({ message: "Class ID is required" });
    }

    const classData = await Model.Classes.findOne({ _id: new ObjectId(classId) });
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const classCost = classData.fees || 0;

    const classSlots = await Model.ClassSlots.find({ classId: new ObjectId(classId) });
    if (!classSlots || classSlots.length === 0) {
      return res.status(404).json({ message: "No class slots found for this class" });
    }

    let totalSeatsAvailable = 0;
    let totalRemainingSeats = 0;

    classSlots.forEach(slot => {
      totalSeatsAvailable += slot.seats || 0;
      totalRemainingSeats += slot.remainingSeats || 0;
    });

    const bookedSeats = totalSeatsAvailable - totalRemainingSeats;
    const totalRevenue = bookedSeats * classCost;
    const averageTicketPrice = bookedSeats ? totalRevenue / bookedSeats : 0;
    const conversionRate = totalSeatsAvailable ? (bookedSeats / totalSeatsAvailable) * 100 : 0;

    // Right now the totalRevenue and NetRevenve is same as we dont have the now of refunded class booking.
    return res.status(200).json({
      classId,
      className: classData.topic || "N/A",
      totalSlots: classSlots.length,
      totalSeatsAvailable,
      totalRemainingSeats,
      bookedSeats,
      classCost,
      totalRevenue,
      averageTicketPrice,
      conversionRate,
    });

  } catch (error) {
    console.error("Error in getClassRevenue:", error);
    next(error);
  }
};

module.exports.getTopTutor = async (req, res, next) => {
  try {
    const tutors = await Model.User.aggregate([
      {
        $match: {
          isDeleted: false,
          role: constants.APP_ROLE.TUTOR
        }
      },
      {
        $lookup: {
          from: "bookings",
          let: { tutorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$tutorId", "$$tutorId"] }
              }
            }
          ],
          as: "bookingDocs"
        }
      },
      {
        $addFields: {
          bookingSlotIds: {
            $map: {
              input: "$bookingDocs",
              as: "b",
              in: "$$b.bookSlotId"
            }
          }
        }
      },
      {
        $addFields: {
          slotCount: { $size: { $setUnion: ["$bookingSlotIds"] } },
          totalStudents: { $size: "$bookingDocs" }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          username: 1,
          totalEarn: 1,
          classEarn: 1,
          followers: 1,
          views: 1,
          avgRating: 1,
          oneOnOneEarn: 1,
          booksCount: 1,
          withdrawAmount: 1,
          balance: 1,
          type: 1,
          role: 1,
          noOfClasses: "$slotCount",
          totalStudents: 1   
        }
      },
      {
        $sort: { totalEarn: -1 }
      }
    ]);

    res.status(200).json({ status: 200, message: "success", data: tutors });
  } catch (error) {
    console.error("Error in getTopTutor:", error);
    next(error);
  }
};

module.exports.getTopClasses = async (req, res, next) => {
    try {
      const result = await Model.Classes.aggregate([
        {
          $lookup: {
            from: "bookings",
            localField: "_id",
            foreignField: "bookClassId",
            as: "bookings"
          }
        },
        {
          $lookup: {
            from: "users",              
            localField: "tutorId",
            foreignField: "_id",
            as: "tutorDetails"
          }
        },
        {
          $lookup: {
            from: "subjects",
            localField: "subjectId",
            foreignField: "_id",
            as: "subjectDetails"
          }
        },
        {
          $addFields: {
            totalBookings: { $size: "$bookings" },
            revenue: {
              $sum: {
                $map: {
                  input: "$bookings",
                  as: "booking",
                  in: { $ifNull: [ "$$booking.grandTotal", 0 ] }
                }
              }
            },
            totalStudents: { $size: "$bookings" },
            tutorName: {
              $arrayElemAt: [ "$tutorDetails.name", 0 ]
            },
            subjectName: {
              $arrayElemAt: [ "$subjectDetails.name", 0 ]
            }
          }
        },
        {
          $project: {
            _id: 1,
            topic: 1,
            totalBookings: 1,
            revenue: 1,
            totalStudents: 1,
            avgRating: 1,
            tutorName: 1,
            subjectName: 1,
          }
        },
        {
          $sort: { revenue: -1 }
        }
      ]);
      res.status(200).json({
        status: true,
        data: result
      });
    } catch (error) {
      console.error("Error in getTopClassesWithBookings:", error);
      next(error);
    }
  };

  module.exports.getAllUsers = async (req, res, next) => {
    try {
      const lang = req.headers.lang || "en";
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const skip = (page - 1) * limit;

      let baseMatch = {};

      if (req.query.status) {
        if (req.query.status === "active") {
          baseMatch.isDeleted = false;
          baseMatch.isActive = true;
          baseMatch.isBlocked = false;
        } else if (req.query.status === "inactive") {
          baseMatch.isDeleted = false;
          baseMatch.isActive = false;
          baseMatch.isBlocked = false;
        } else if (req.query.status === "deleted") {
          baseMatch.isDeleted = true;
        } else if (req.query.status === "blocked") {
          baseMatch.isBlocked = true;
        }
      } else {
        baseMatch.isDeleted = req.query.delete === "true" ? true : false;
      }

      if (req.query.role) {
        if (req.query.role === "tutor") {
          baseMatch.role = constants.APP_ROLE.TUTOR;
        } else if (req.query.role === "parent") {
          baseMatch.role = constants.APP_ROLE.PARENT;
        }
      } else {
        baseMatch.role = { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] };
      }

      if (req.query.tutorStatus) {
        baseMatch.tutorStatus = Number(req.query.tutorStatus);
      }

      let pipeline = [
        {
          $match: {
            ...baseMatch,
            ...(req.query.name && {
              name: { $regex: req.query.name, $options: "i" }
            }),
            ...(req.query.search && {
              $or: [
                { name: { $regex: req.query.search, $options: "i" } },
                { email: { $regex: req.query.search, $options: "i" } },
                { phoneNo: { $regex: req.query.search, $options: "i" } },
                { userName: { $regex: req.query.search, $options: "i" } }
              ]
            })
          }
        },
        {
          $addFields: {
            roleType: {
              $switch: {
                branches: [
                  { case: { $eq: ["$role", constants.APP_ROLE.TUTOR] }, then: "tutor" },
                  { case: { $eq: ["$role", constants.APP_ROLE.PARENT] }, then: "parent" }
                ],
                default: "unknown"
              }
            }
          }
        },
        {
          $sort: {
            [baseMatch.isDeleted ? "updatedAt" : "createdAt"]: -1
          }
        },
        {
          $project: {
            name: 1,
            userName: 1,
            email: 1,
            dialCode: 1,
            phoneNo: 1,
            gender: 1,
            age: 1,
            image: 1,
            address: 1,
            shortBio: 1,
            role: 1,
            roleType: 1,
            tutorStatus: 1,
            isPhoneVerified: 1,
            isEmailVerified: 1,
            isBlocked: 1,
            isDeleted: 1,
            isProfileComplete: 1,
            isActive: 1,
            isOnline: 1,
            latitude: 1,
            longitude: 1,
            avgRating: 1,
            followers: 1,
            views: 1,
            totalEarn: 1,
            createdAt: 1,
            updatedAt: 1
          }
        }
      ];

      const tutorCountPipeline = [
        {
          $match: {
            role: constants.APP_ROLE.TUTOR,
            isDeleted: req.query.delete === "true" ? true : false
          }
        },
        {
          $count: "totalTutors"
        }
      ];

      const parentCountPipeline = [
        {
          $match: {
            role: constants.APP_ROLE.PARENT,
            isDeleted: req.query.delete === "true" ? true : false
          }
        },
        {
          $count: "totalParents"
        }
      ];

      const onlineTutorsPipeline = [
        {
          $match: {
            role: constants.APP_ROLE.TUTOR,
            isDeleted: false,
            isActive: true
          }
        },
        {
          $count: "onlineTutors"
        }
      ];
      const totalUsersPipeline = [
        {
          $match: {
            role: { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] }
          }
        },
        {
          $count: "totalUsers"
        }
      ];
      const activeUsersPipeline = [
        {
          $match: {
            role: { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] },
            isDeleted: false,
            isActive: true
          }
        },
        {
          $count: "activeUsers"
        }
      ];
      const inActiveUsersPipeline = [
        {
          $match: {
            role: { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] },
            isDeleted: false,
            isActive: false
          }
        },
        {
          $count: "inActiveUsers"
        }
      ];
      const deletedUsersPipeline = [
        {
          $match: {
            role: { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] },
            isDeleted: true
          }
        },
        {
          $count: "inActiveUsers"
        }
      ];
      const nullUsersPipeline = [
        {
          $match: {
            role: { $in: [constants.APP_ROLE.TUTOR, constants.APP_ROLE.PARENT] },
            isDeleted: false,
            isActive: null
          }
        },
        {
          $count: "inActiveUsers"
        }
      ];

      pipeline = await common.pagination(pipeline, skip, limit);
      const [users] = await Model.User.aggregate(pipeline);
      const tutorCount = await Model.User.aggregate(tutorCountPipeline);
      const parentCount = await Model.User.aggregate(parentCountPipeline);
      const onlineTutors = await Model.User.aggregate(onlineTutorsPipeline);
      const totalUsersCount = await Model.User.aggregate(totalUsersPipeline);
      const activeUsersCount = await Model.User.aggregate(activeUsersPipeline);
      const inActiveUsersCount = await Model.User.aggregate(inActiveUsersPipeline);
      const nullUsersCount = await Model.User.aggregate(nullUsersPipeline);
      const deletedUsersCount = await Model.User.aggregate(deletedUsersPipeline);

      return res.success(constants.MESSAGES[lang].DATA_FETCHED, {
        users: users?.data || [],
        totalUsers: totalUsersCount?.[0]?.totalUsers || 0,
        activeUsers: activeUsersCount?.[0]?.activeUsers || 0,
        inActiveUsers: inActiveUsersCount?.[0]?.inActiveUsers || 0,
        deletedUsers: deletedUsersCount?.[0]?.inActiveUsers || 0,
        nullUsers: nullUsersCount?.[0]?.inActiveUsers || 0,
        totalTutors: tutorCount?.[0]?.totalTutors || 0,
        totalParents: parentCount?.[0]?.totalParents || 0,
        onlineTutors: onlineTutors?.[0]?.onlineTutors || 0
      });
    } catch (error) {
      next(error);
    }
};

  
  module.exports.getTutorStats = async (req, res, next) => {
    try {
      const totalTutorsPipeline = [
        { $match: { role: constants.APP_ROLE.TUTOR } },
        { $count: "totalTutors" }
      ];
  
      const activeTutorsPipeline = [
        { $match: { role: constants.APP_ROLE.TUTOR, isActive: true, isDeleted: false } },
        { $count: "activeTutors" }
      ];
  
      const inActiveTutorsPipeline = [
        { $match: { role: constants.APP_ROLE.TUTOR, isActive: false, isDeleted: false } },
        { $count: "inActiveTutors" }
      ];
  
      const nullTutorsPipeline = [
        { $match: { role: constants.APP_ROLE.TUTOR, isActive: { $exists: false }, isDeleted: false } },
        { $count: "nullTutors" }
      ];
  
      const deletedTutorsPipeline = [
        { $match: { role: constants.APP_ROLE.TUTOR, isDeleted: true } },
        { $count: "deletedTutors" }
      ];
  
      const [
        totalTutorsResult,
        activeTutorsResult,
        inActiveTutorsResult,
        nullTutorsResult,
        deletedTutorsResult
      ] = await Promise.all([
        Model.User.aggregate(totalTutorsPipeline),
        Model.User.aggregate(activeTutorsPipeline),
        Model.User.aggregate(inActiveTutorsPipeline),
        Model.User.aggregate(nullTutorsPipeline),
        Model.User.aggregate(deletedTutorsPipeline)
      ]);
  
      return res.success("Tutor stats fetched", {
        totalTutors: totalTutorsResult?.[0]?.totalTutors || 0,
        activeTutors: activeTutorsResult?.[0]?.activeTutors || 0,
        inActiveTutors: inActiveTutorsResult?.[0]?.inActiveTutors || 0,
        nullTutors: nullTutorsResult?.[0]?.nullTutors || 0,
        deletedTutors: deletedTutorsResult?.[0]?.deletedTutors || 0
      });
    } catch (error) {
      next(error);
    }
  };
  
  module.exports.getParentStats = async (req, res, next) => {
    try {
      const totalParentsPipeline = [
        { $match: { role: constants.APP_ROLE.PARENT } },
        { $count: "totalParents" }
      ];
  
      const activeParentsPipeline = [
        { $match: { role: constants.APP_ROLE.PARENT, isActive: true, isDeleted: false } },
        { $count: "activeParents" }
      ];
  
      const inActiveParentsPipeline = [
        { $match: { role: constants.APP_ROLE.PARENT, isActive: false, isDeleted: false } },
        { $count: "inActiveParents" }
      ];
  
      const nullParentsPipeline = [
        { $match: { role: constants.APP_ROLE.PARENT, isActive: { $exists: false }, isDeleted: false } },
        { $count: "nullParents" }
      ];
  
      const deletedParentsPipeline = [
        { $match: { role: constants.APP_ROLE.PARENT, isDeleted: true } },
        { $count: "deletedParents" }
      ];
  
      const [
        totalParentsResult,
        activeParentsResult,
        inActiveParentsResult,
        nullParentsResult,
        deletedParentsResult
      ] = await Promise.all([
        Model.User.aggregate(totalParentsPipeline),
        Model.User.aggregate(activeParentsPipeline),
        Model.User.aggregate(inActiveParentsPipeline),
        Model.User.aggregate(nullParentsPipeline),
        Model.User.aggregate(deletedParentsPipeline)
      ]);
  
      return res.success("Parent stats fetched", {
        totalParents: totalParentsResult?.[0]?.totalParents || 0,
        activeParents: activeParentsResult?.[0]?.activeParents || 0,
        inActiveParents: inActiveParentsResult?.[0]?.inActiveParents || 0,
        nullParents: nullParentsResult?.[0]?.nullParents || 0,
        deletedParents: deletedParentsResult?.[0]?.deletedParents || 0
      });
    } catch (error) {
      next(error);
    }
  };
  
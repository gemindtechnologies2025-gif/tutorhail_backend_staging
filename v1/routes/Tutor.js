const Controller = require('../controller');
const Auth = require("../../common/authenticate");
const { activityTracker } = require('../../common');
const router = require('express').Router();

//Onboarding
router.post("/signup", Controller.TutorController.signup);
router.post("/socialLogin", activityTracker.trackUserActivity, Controller.TutorController.socialLogin);
router.post("/login", activityTracker.trackUserActivity, Controller.TutorController.login);
router.get("/logout", Auth.verify("user"), Controller.TutorController.logout);
router.get("/getProfile", Auth.verify("user"), Controller.TutorController.getProfile);
router.delete("/deleteProfile", Auth.verify("user"), Controller.TutorController.deleteProfile);
router.put("/updateProfile", Auth.verify("user"), Controller.TutorController.updateProfile);
router.post("/resetPassword", Auth.verify("user"), Controller.TutorController.resetPassword);
router.put("/changePassword", Auth.verify("user"), Controller.TutorController.changePassword);
router.post("/forgotPassword", Controller.TutorController.sendOtp);

//Otp
router.post("/sendOtp", Auth.verify("guestuser"), Controller.TutorController.sendOtp);
router.post("/verifyOtp", Auth.verify("guestuser"),Controller.TutorController.verifyOtp);

//Bank Details
router.post("/addBank", Auth.verify("user"), Controller.TutorController.addBank);
router.get("/getBank/:id?", Auth.verify("user"), Controller.TutorController.getBank);
router.put("/updateBank/:id", Auth.verify("user"), Controller.TutorController.updateBank);
router.delete("/deleteBank/:id", Auth.verify("user"), Controller.TutorController.deleteBank);

//Teaching Details
router.post("/teachingDetails", Auth.verify("user"), Controller.TutorController.teachingDetails);
router.delete("/deleteTeachingDetails/:id", Auth.verify("user"), Controller.TutorController.deleteTeachingDetails);
router.get("/getTeachingDetails", Auth.verify("user"), Controller.TutorController.getTeachingDetails);

//Documents
router.post("/addDocuments", Auth.verify("user"), Controller.TutorController.addDocuments);
router.get("/getDocuments", Auth.verify("user"), Controller.TutorController.getDocuments);
router.put("/updateDocuments/:id", Auth.verify("user"), Controller.TutorController.updateDocuments);
router.delete("/deleteDocuments/:id", Auth.verify("user"), Controller.TutorController.deleteDocuments);

//Dashboard
router.get("/dashboard", Auth.verify("user"), Controller.TutorController.dashboard);

//Earning Withdraw
router.post("/withdraw", Auth.verify("user"), Controller.TutorController.withdraw);

//Booking
router.get("/getBooking/:id?", Auth.verify("user"), Controller.TutorController.getBooking);
router.put("/updateBooking/:id", Auth.verify("user"), Controller.TutorController.updateBooking);

//Pairing
router.post("/pairingOtp", Auth.verify("user"), Controller.TutorController.pairingOtp);
router.post("/verifyPairingOtp", Auth.verify("user"), Controller.TutorController.verifyPairingOtp);

//ContentMaterial
router.post("/contentMaterial", Auth.verify("user"), Controller.TutorController.contentMaterial);
router.get("/contentMaterial", Auth.verify("user"), Controller.TutorController.getContentMaterial);
router.get("/contentMaterial/:id", Auth.verify("user"), Controller.TutorController.getContentMaterialById);
router.put("/contentMaterial/:id", Auth.verify("user"), Controller.TutorController.updateContentMaterial);
router.delete("/contentMaterial/:id", Auth.verify("user"), Controller.TutorController.deleteContentMaterial);

//Notification
router.get("/notification", Auth.verify("user"), Controller.TutorController.getNotification);

//Chat
router.get("/chatList", Auth.verify("user"), Controller.TutorController.chatList);
router.get("/chating/:id", Auth.verify("user"), Controller.TutorController.chating);

//Video Call
router.post("/joinVideoCall", Auth.verify("user"), Controller.TutorController.joinVideoCall);

//reviews
router.get("/reviews", Auth.verify("user"), Controller.TutorController.getReviews);

//Customer Support
router.post("/customersupport", Auth.verify("user"), Controller.TutorController.support);

//cms
router.get("/cms", Controller.TutorController.getCms);

//Listing
router.get("/subClassList", Auth.verify("user"), Controller.TutorController.subClassList);
router.get("/tutorList", Auth.verify("user"), Controller.TutorController.tutorList);
router.get("/promocodeList", Auth.verify("user"), Controller.TutorController.promocodeList);

//Class
router.post("/createClass", Auth.verify("user"), Controller.TutorController.createClass);
router.get("/getClass", Auth.verify("user"), Controller.TutorController.getClass);
router.get("/getClass/:id", Auth.verify("user"), Controller.TutorController.getClassById);
router.put("/updateClass/:id", Auth.verify("user"), Controller.TutorController.updateClass);
router.delete("/deleteClass/:id", Auth.verify("user"), Controller.TutorController.deleteClass);
router.get("/classSlots/:id", Auth.verify("user"), Controller.TutorController.classSlots);
router.put("/classSlots", Auth.verify("user"), Controller.TutorController.updateSlotsStatus);
router.post("/coTutorStatus", Auth.verify("user"), Controller.TutorController.coTutorStatus);

//Content
router.post("/createContent", Auth.verify("user"), Controller.TutorController.createContent);
router.get("/getContent", Auth.verify("user"), Controller.TutorController.getContent);
router.get("/getContent/:id", Auth.verify("user"), Controller.TutorController.getContentById);
router.put("/updateContent/:id", Auth.verify("user"), Controller.TutorController.updateContent);
router.delete("/deleteContent/:id", Auth.verify("user"), Controller.TutorController.deleteContent);

//Engagement
router.post("/engagement", Auth.verify("user"), Controller.TutorController.engage);
router.post("/commentEngagement", Auth.verify("user"), Controller.TutorController.commentEngagement);
router.get("/comments/:id", Auth.verify("user"), Controller.TutorController.getComments);

//Gifts
router.get("/gifts", Auth.verify("user"), Controller.TutorController.gifts);

//Promo Codes
router.post("/addPromocode", Auth.verify("user"), Controller.TutorController.addPromoCode);
router.get("/getPromocode", Auth.verify("user"), Controller.TutorController.getPromoCode);
router.get("/getPromocode/:id", Auth.verify("user"), Controller.TutorController.getPromoCodeById);
router.put("/updatePromocode/:id", Auth.verify("user"), Controller.TutorController.updatePromoCode);
router.delete("/deletePromocode/:id", Auth.verify("user"), Controller.TutorController.deletePromoCode);
router.get("/promoDetails", Auth.verify("user"), Controller.TutorController.promoDetails);

//Social Media Links
router.post("/socialLinks", Auth.verify("user"), Controller.TutorController.createSocialLinks);
router.get("/socialLinks", Auth.verify("user"), Controller.TutorController.getSocialLinks);
router.delete("/socialLinks/:id", Auth.verify("user"), Controller.TutorController.deleteSocialLinks);

//Class Bookings
router.get("/classBook", Auth.verify("user"), Controller.TutorController.classBooking);
router.get("/userBook/:id", Auth.verify("user"), Controller.TutorController.userBook);
//router.get("/classBook/:id", Auth.verify("user"), Controller.TutorController.bookClassById);

//Followers
router.get("/followers", Auth.verify("user"), Controller.TutorController.followers);

//Viewers
router.get("/viewers", Auth.verify("user"), Controller.TutorController.viewers);

//Category Subject
router.get("/catSubList", Auth.verify("user"), Controller.TutorController.catSubList);

//Inquiry
router.get("/inquiry", Auth.verify("user"), Controller.TutorController.getInquiry);
router.get("/inquiry/:id", Auth.verify("user"), Controller.TutorController.getInquiryById);
router.post("/inquiryRevert", Auth.verify("user"), Controller.TutorController.inquiryRevert);

//Block Report Chat
router.post("/blockReportChat", Auth.verify("user"), Controller.TutorController.blockReportChat);
router.post("/agreeChat", Auth.verify("user"), Controller.TutorController.agreeChat);

//Subject list
router.post("/subjectList", Auth.verify("user"), Controller.TutorController.subjectList);

//Poll Result
router.get("/pollResult/:id", Auth.verify("user"), Controller.TutorController.pollResult);
router.get("/usersVoted", Auth.verify("user"), Controller.TutorController.usersVoted);

//Poll vote
router.post("/pollVote", Auth.verify("user"), Controller.TutorController.pollVote);

module.exports = router;
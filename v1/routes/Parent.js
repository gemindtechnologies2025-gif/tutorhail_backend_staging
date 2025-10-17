const Controller = require('../controller');
const Auth = require("../../common/authenticate");
const { activityTracker } = require('../../common');
const router = require('express').Router();

//Onboarding
router.post("/signup", Controller.ParentController.signup);
router.post("/socialLogin", activityTracker.trackUserActivity, Controller.ParentController.socialLogin);
router.post("/login", activityTracker.trackUserActivity, Controller.ParentController.login);
router.get("/logout", Auth.verify("user"), Controller.ParentController.logout);
router.get("/getProfile", Auth.verify("user"), Controller.ParentController.getProfile);
router.delete("/deleteProfile", Auth.verify("user"), Controller.ParentController.deleteProfile);
router.put("/updateProfile", Auth.verify("user"), Controller.ParentController.updateProfile);
router.post("/resetPassword", Auth.verify("user"), Controller.ParentController.resetPassword);
router.put("/changePassword", Auth.verify("user"), Controller.ParentController.changePassword);
router.post("/forgotPassword", Controller.ParentController.sendOtp);

//Otp
router.post("/sendOtp", Auth.verify("guestuser"), Controller.ParentController.sendOtp);
router.post("/verifyOtp", Auth.verify("guestuser"),Controller.ParentController.verifyOtp);

//linkedin login
router.post("/linkedInToken", Controller.ParentController.linkedInToken);

//Address
router.post("/addAddress", Auth.verify("user"), Controller.ParentController.addAddress);
router.get("/getAddress/:id?", Auth.verify("user"), Controller.ParentController.getAddress);
router.put("/updateAddress/:id", Auth.verify("user"), Controller.ParentController.updateAddress);
router.delete("/deleteAddress/:id", Auth.verify("user"), Controller.ParentController.deleteAddress);

//Search
router.post("/search", Auth.verify("user", "guestuser"), Controller.ParentController.addSearch);
router.get("/search", Auth.verify("user", "guestuser"), Controller.ParentController.getSearch);
router.delete("/search", Auth.verify("user", "guestuser"), Controller.ParentController.deleteSearch);

//Tutor
router.get("/dashBoard", Auth.verify("user", "guestuser"), Controller.ParentController.dashBoard);
router.post("/tutor", Auth.verify("user", "guestuser"), Controller.ParentController.getTutor);
router.get("/tutor/:id", Auth.verify("user", "guestuser"), Controller.ParentController.tutor);
router.get("/homepage", Auth.verify("user", "guestuser"), Controller.ParentController.homepage);
router.post("/reportTutor", Auth.verify("user"), Controller.ParentController.reportTutor);

//WishList
router.post("/addWishlist", Auth.verify("user"), Controller.ParentController.addWishlist);
router.get("/getWishlist", Auth.verify("user"), Controller.ParentController.getWishlist);

//Bookings
router.post("/booking", Auth.verify("user"), Controller.ParentController.addBooking);
router.get("/timeCheck/:id", Auth.verify("user", "guestuser"), Controller.ParentController.getBookingSlots);
router.get("/getBooking/:id?", Auth.verify("user"), Controller.ParentController.getBooking);
router.put("/cancelBooking/:id", Auth.verify("user"), Controller.ParentController.cancelBooking);
router.get("/bookingDetail/:id", Auth.verify("user"), Controller.ParentController.bookingDetail);

//Settings
router.get("/setting", Auth.verify("user"), Controller.ParentController.setting);

//Study Material
router.get("/studyMaterial/:id?", Auth.verify("user"), Controller.ParentController.studyMaterial);

//Notification
router.get("/notification", Auth.verify("user"), Controller.ParentController.getNotification);

//Rating
router.post("/addRating", Auth.verify("user"), Controller.ParentController.addRating);

//Customer Support
router.post("/customersupport", Auth.verify("user"), Controller.ParentController.support);

//Video Call
router.post("/joinVideoCall", Auth.verify("user"), Controller.ParentController.joinVideoCall);

//CMS
router.get("/cms", Controller.ParentController.getCms);

//Chat list
router.get("/chatList", Auth.verify("user"), Controller.TutorController.chatList);
router.get("/chating/:id", Auth.verify("user"), Controller.TutorController.chating);

//Class
router.get("/getClass", Auth.verify("user", "guestuser"), Controller.ParentController.getClass);
router.get("/getClass/:id", Auth.verify("user", "guestuser"), Controller.ParentController.getClassById);
router.post("/saveClass", Auth.verify("user"), Controller.ParentController.saveClass);
router.get("/saveClass", Auth.verify("user", "guestuser"), Controller.ParentController.getSaveClass);
router.post("/shareClass", Auth.verify("user"), Controller.ParentController.shareClass);
router.post("/reportClass", Auth.verify("user"), Controller.ParentController.reportClass);

//Class Slots
router.get("/classSlots/:id", Auth.verify("user", "guestuser"), Controller.ParentController.classSlots);

//Content
router.post("/createContent", Auth.verify("user"), Controller.ParentController.createContent);
router.get("/getContent", Auth.verify("user","guestuser"), Controller.ParentController.getContent);
router.get("/getContent/:id", Auth.verify("user", "guestuser"), Controller.ParentController.getContentById);
router.put("/updateContent/:id", Auth.verify("user"), Controller.ParentController.updateContent);
router.delete("/deleteContent/:id", Auth.verify("user"), Controller.ParentController.deleteContent);
router.get("/saveContent", Auth.verify("user"), Controller.ParentController.saveContent);
router.post("/reportContent", Auth.verify("user"), Controller.ParentController.reportContent);

//Engagement
router.post("/engagement", Auth.verify("user"), Controller.ParentController.engage);
router.post("/commentEngagement", Auth.verify("user"), Controller.ParentController.commentEngagement);
router.get("/comments/:id", Auth.verify("user", "guestuser"), Controller.ParentController.getComments);

//Follow
router.post("/follow", Auth.verify("user"), Controller.ParentController.follow);

//PromoCode
router.get("/promocode", Auth.verify("user"), Controller.ParentController.getPromoCode);

//Inquiry
router.post("/inquiry", Auth.verify("user", "guestuser"), Controller.ParentController.createInquiry);
router.get("/inquiry", Auth.verify("user"), Controller.ParentController.getInquiry);
router.get("/inquiry/:id", Auth.verify("user"), Controller.ParentController.getInquiryById);

//Class Booking
router.post("/classBook", Auth.verify("user"), Controller.ParentController.classBooking);
router.get("/classBook", Auth.verify("user"), Controller.ParentController.getBookedClasses);
//router.get("/classBook/:id", Auth.verify("user"), Controller.ParentController.bookClassById);

//Banner
router.get("/banner", Auth.verify("user", "guestuser"), Controller.ParentController.banner);

//Category Subject
router.get("/catSubList", Auth.verify("user", "guestuser"), Controller.ParentController.catSubList);

//Tutor Social links
router.get("/socialLinks", Auth.verify("user", "guestuser"), Controller.ParentController.socialLinks);

//Block Report Chat
router.post("/blockReportChat", Auth.verify("user"), Controller.ParentController.blockReportChat);
router.post("/agreeChat", Auth.verify("user"), Controller.ParentController.agreeChat);

//Poll vote
router.post("/pollVote", Auth.verify("user"), Controller.ParentController.pollVote);

module.exports = router;                                                                                                                                                                                                                                                                                                            
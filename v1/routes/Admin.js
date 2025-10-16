const router = require("express").Router();
const Auth = require("../../common/authenticate");
const Controller = require("../controller");

// ONBOARDING API'S
router.post("/register", Controller.AdminController.register);
router.post("/login", Controller.AdminController.login);
router.get("/logout", Auth.verify("admin"), Controller.AdminController.logout);
router.get("/getProfile", Auth.verify("admin"), Controller.AdminController.getProfile);
router.put("/updateProfile", Auth.verify("admin"), Controller.AdminController.updateProfile);
router.post("/changePassword", Auth.verify("admin"), Controller.AdminController.changePassword);
router.post("/resetPassword", Auth.verify("admin"), Controller.AdminController.resetPassword);
router.post("/forgotPassword", Controller.AdminController.sendOtp);
router.post("/verifyOtp", Controller.AdminController.verifyOtp);
router.post("/sendOtp", Controller.AdminController.sendOtp);

//Dashboard
router.get("/dashboard", Auth.verify("admin"), Controller.AdminController.dashboard);
router.get("/earningGraph", Auth.verify("admin"), Controller.AdminController.earningGraph);

//User - Parent
router.post("/addParent", Auth.verify("admin"), Controller.AdminController.addParent);
router.get("/getParent/:id?", Auth.verify("admin"), Controller.AdminController.getParent);
router.put("/updateParent/:id", Auth.verify("admin"), Controller.AdminController.updateParent);
router.delete("/deleteParent/:id", Auth.verify("admin"), Controller.AdminController.deleteParent);
router.get("/parentExport", Auth.verify("admin"), Controller.AdminController.parentExport);

//Parent - Booking Details
router.get("/parentbooking/:id", Auth.verify("admin"), Controller.AdminController.parentBooking);
router.get("/getTutorStats", Auth.verify("admin"), Controller.AdminController.getTutorStats);
router.get("/getParentStats", Auth.verify("admin"), Controller.AdminController.getParentStats);

//User - Tutor
router.post("/addTutor", Auth.verify("admin"), Controller.AdminController.addTutor);
router.get("/getTutor/:id?", Auth.verify("admin"), Controller.AdminController.getTutor);
router.put("/updateTutor", Auth.verify("admin"), Controller.AdminController.updateTutor);
router.delete("/deleteTutor/:id", Auth.verify("admin"), Controller.AdminController.deleteTutor);
router.get("/tutorExport", Auth.verify("admin"), Controller.AdminController.tutorExport);
router.get("/getTutorDetails/:id", Auth.verify("admin"), Controller.AdminController.getTutorDetails);
router.get("/getTopTutor", Auth.verify("admin"), Controller.AdminController.getTopTutor);

//Get All Users (Tutors and Parents)
router.get("/getAllUsers", Auth.verify("admin"), Controller.AdminController.getAllUsers);

//Tutor - Teaching Details
router.post("/teachingDetails", Auth.verify("admin"), Controller.AdminController.teachingDetails);
router.get("/getTeachingDetails/:id", Auth.verify("admin"), Controller.AdminController.getTeachingDetails);
router.delete("/deleteTeachingDetails/:id", Auth.verify("admin"), Controller.AdminController.deleteTeachingDetails);

//Tutor - Bank Details
router.post("/addBankDetails", Auth.verify("admin"), Controller.AdminController.addBankDetails);
router.get("/getBankDetails/:id?", Auth.verify("admin"), Controller.AdminController.getBankDetails);
router.put("/updateBankDetails", Auth.verify("admin"), Controller.AdminController.updateBankDetails);
router.delete("/deleteBankDetails/:id", Auth.verify("admin"), Controller.AdminController.deleteBankDetails);

//Tutor - Documents
router.post("/addDocuments", Auth.verify("admin"), Controller.AdminController.addDocuments);
router.get("/getDocuments/:id", Auth.verify("admin"), Controller.AdminController.getDocuments);
router.put("/updateDocuments/:id", Auth.verify("admin"), Controller.AdminController.updateDocuments);
router.delete("/deleteDocuments/:id", Auth.verify("admin"), Controller.AdminController.deleteDocuments);
router.put("/approveDocument/:id", Auth.verify("admin"), Controller.AdminController.approveDocument);
router.put("/rejectDocument/:id", Auth.verify("admin"), Controller.AdminController.rejectDocument);
router.post("/requestDocument", Auth.verify("admin"), Controller.AdminController.requestDocument);

//Tutor - review
router.get("/tutorReview/:id", Auth.verify("admin"), Controller.AdminController.tutorReview);

//Tutor - Activity history
router.get("/activityHistory/:id", Auth.verify("admin"), Controller.AdminController.activityHistory);

//Tutor - Withdraw
router.get("/tutorEarning/:id", Auth.verify("admin"), Controller.AdminController.tutorEarning);
router.put("/withdrawStatus", Auth.verify("admin"), Controller.AdminController.withdrawStatus);
router.get("/tutorPayment", Auth.verify("admin"), Controller.AdminController.tutorPayment);

//Booking
router.get("/booking/:id?", Auth.verify("admin"), Controller.AdminController.getBooking);
router.get("/export", Auth.verify("admin"), Controller.AdminController.bookingExport);

//Invoice
router.get("/invoice/:id", Auth.verify("admin"), Controller.AdminController.invoice);

//Rating and reviews
router.get("/review/:id?", Auth.verify("admin"), Controller.AdminController.getReviews);
router.delete("/deleteReview/:id", Auth.verify("admin"), Controller.AdminController.deleteReview);

//Reports and Analytics
router.get("/userGraph", Auth.verify("admin"), Controller.AdminController.userGraph);
router.get("/tutorGraph", Auth.verify("admin"), Controller.AdminController.tutorGraph);
router.get("/bookingGraph", Auth.verify("admin"), Controller.AdminController.bookingGraph);
router.get("/followerGraph", Auth.verify("admin"), Controller.AdminController.followerGraph);
router.get("/contentViewsGraph", Auth.verify("admin"), Controller.AdminController.contentViewsGraph);

//CustomerSupport
router.get("/customersupport", Auth.verify("admin"), Controller.AdminController.support);
router.delete("/customersupport/:id", Auth.verify("admin"), Controller.AdminController.deleteSupport);
router.post("/revertQuery/:id", Auth.verify("admin"), Controller.AdminController.revertQuery);

//Notifications
router.post("/notification", Auth.verify("admin"), Controller.AdminController.addNotification);
router.get("/notification/:id?", Auth.verify("admin"), Controller.AdminController.getNotification);
router.delete("/notification/:id", Auth.verify("admin"), Controller.AdminController.deleteNotification);

// CMS
router.post("/addCms", Auth.verify("admin"), Controller.AdminController.addCms);
router.get("/getCms", Controller.AdminController.getCms);

//Settings
router.post("/setting", Auth.verify("admin"), Controller.AdminController.addSetting);
router.put("/setting/:id", Auth.verify("admin"), Controller.AdminController.updateSetting);
router.get("/setting/:id", Auth.verify("admin"), Controller.AdminController.getSettingById);
router.delete("/setting/:id", Auth.verify("admin"), Controller.AdminController.deleteSetting);
router.get("/setting", Auth.verify("admin"), Controller.AdminController.getSetting);

//Refund
router.post("/refundBookingAmount/:id", Auth.verify("admin"), Controller.AdminController.refundBookingAmount);
router.get("/refundList", Auth.verify("admin"), Controller.AdminController.refundList);
router.put("/refundPayment/:id",Auth.verify("admin"), Controller.AdminController.refundPayment);

//Listings
router.get("/subClassList", Auth.verify("admin"), Controller.AdminController.subClassList);
router.get("/tutorList", Auth.verify("admin"), Controller.AdminController.tutorList);

//Class
router.post("/addClass", Auth.verify("admin"), Controller.AdminController.addClass);
router.get("/getClass", Auth.verify("admin"), Controller.AdminController.getClass);
router.get("/getClass/:id", Auth.verify("admin"), Controller.AdminController.getClassById);
router.get("/getClassSlots/:id", Auth.verify("admin"), Controller.AdminController.getClassSlots);
router.put("/updateClass/:id", Auth.verify("admin"), Controller.AdminController.updateClass);
router.delete("/deleteClass/:id", Auth.verify("admin"), Controller.AdminController.deleteClass);
router.get("/classExport", Auth.verify("admin"), Controller.AdminController.classExport);
router.get("/classDetails", Auth.verify("admin"), Controller.AdminController.classDetails);
router.get("/getClassRevenue/:classId", Auth.verify("admin"), Controller.AdminController.getClassRevenue);


//Promo Codes
router.post("/addPromocode", Auth.verify("admin"), Controller.AdminController.addPromoCode);
router.get("/getPromocode", Auth.verify("admin"), Controller.AdminController.getPromoCode);
router.get("/getPromocode/:id", Auth.verify("admin"), Controller.AdminController.getPromoCodeById);
router.put("/updatePromocode/:id", Auth.verify("admin"), Controller.AdminController.updatePromoCode);
router.delete("/deletePromocode/:id", Auth.verify("admin"), Controller.AdminController.deletePromoCode);
router.get("/exportPromocode", Auth.verify("admin"), Controller.AdminController.promocodeExport);

//Content
router.post("/createContent", Auth.verify("admin"), Controller.AdminController.createContent);
router.get("/getContent", Auth.verify("admin"), Controller.AdminController.getContent);
router.get("/getContent/:id", Auth.verify("admin"), Controller.AdminController.getContentById);
router.put("/updateContent", Auth.verify("admin"), Controller.AdminController.updateContent);
router.delete("/deleteContent/:id", Auth.verify("admin"), Controller.AdminController.deleteContent);
router.get("/contentDetails", Auth.verify("admin"), Controller.AdminController.contentDetails);

//Inquiry
router.get("/inquiry", Auth.verify("admin"), Controller.AdminController.getInquiry);
router.post("/inquiryRevert", Auth.verify("admin"), Controller.AdminController.inquiryRevert);
router.delete("/inquiry/:id", Auth.verify("admin"), Controller.AdminController.deleteInquiry);

//Banner
router.post("/banner", Auth.verify("admin"), Controller.AdminController.addBanner);
router.get("/banner", Auth.verify("admin"), Controller.AdminController.getBanner);
router.get("/banner/:id", Auth.verify("admin"), Controller.AdminController.getBannerById);
router.put("/banner/:id", Auth.verify("admin"), Controller.AdminController.updateBanner);
router.delete("/banner/:id", Auth.verify("admin"), Controller.AdminController.deleteBanner);

//Category
router.post("/category", Auth.verify("admin"), Controller.AdminController.addCategory);
router.get("/category", Auth.verify("admin"), Controller.AdminController.getCategory);
router.get("/category/:id", Auth.verify("admin"), Controller.AdminController.getCategoryById);
router.put("/category/:id", Auth.verify("admin"), Controller.AdminController.updateCategory);
router.delete("/category/:id", Auth.verify("admin"), Controller.AdminController.deleteCategory);

//Subjects
router.post("/subjects", Auth.verify("admin"), Controller.AdminController.addSubject);
router.get("/subjects", Auth.verify("admin"), Controller.AdminController.getSubject);
router.get("/subjects/:id", Auth.verify("admin"), Controller.AdminController.getSubjectById);
router.put("/subjects/:id", Auth.verify("admin"), Controller.AdminController.updateSubject);
router.delete("/subjects/:id", Auth.verify("admin"), Controller.AdminController.deleteSubject);

//Category Subject
router.get("/catSubList", Auth.verify("admin"), Controller.AdminController.catSubList);

//Class 
router.get("/classBook", Auth.verify("admin"), Controller.AdminController.getBookedClasses);
router.get("/classBook/:id", Auth.verify("admin"), Controller.AdminController.bookClassById);
router.get("/getTopClasses", Auth.verify("admin"), Controller.AdminController.getTopClasses);

//Content Report
router.get("/contentReport", Auth.verify("admin"), Controller.AdminController.getContentReport);
router.post("/contentReport", Auth.verify("admin"), Controller.AdminController.contentReportRevert);
router.delete("/contentReport/:id", Auth.verify("admin"), Controller.AdminController.deleteContentReport);

//Tutor Report
router.get("/tutorReport", Auth.verify("admin"), Controller.AdminController.getTutorReport);
router.post("/tutorReport", Auth.verify("admin"), Controller.AdminController.tutorReportRevert);
router.delete("/tutorReport/:id", Auth.verify("admin"), Controller.AdminController.deleteTutorReport);

//Chat Report
router.get("/chatReport", Auth.verify("admin"), Controller.AdminController.getChatReport);
router.post("/chatReport", Auth.verify("admin"), Controller.AdminController.chatReportRevert);
router.delete("/chatReport/:id", Auth.verify("admin"), Controller.AdminController.deleteChatReport);
router.get("/chat/:id", Auth.verify("admin"), Controller.AdminController.chat);

//Subject list
router.post("/subjectList", Auth.verify("admin"), Controller.AdminController.subjectList);

//Class Report
router.get("/classReport", Auth.verify("admin"), Controller.AdminController.getClassReport);
router.post("/classReport", Auth.verify("admin"), Controller.AdminController.classReportRevert);
router.delete("/classReport/:id", Auth.verify("admin"), Controller.AdminController.deleteClassReport);

//All reports
router.get("/reports", Auth.verify("admin"), Controller.AdminController.getReports);
router.get("/reportsCount", Auth.verify("admin"), Controller.AdminController.reportsCount);

//Meeting Analytics
router.get('/meeting/chat-analytics/:classId/:slotId', Auth.verify("admin"), Controller.AdminController.getChatAnalytics);
router.get('/meeting/analytics/:classId/:slotId', Auth.verify("admin"), Controller.AdminController.getMeetingAnalytics);

module.exports = router;
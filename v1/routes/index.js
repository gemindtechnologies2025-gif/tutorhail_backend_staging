const router = require("express").Router();
const ParentRoutes = require("./Parent");
const TutorRoutes = require("./Tutor");
const AdminRoutes = require("./Admin");
const uploadRoutes=require("./Upload");
const PaymentRoutes = require("./Payment");
const services = require("../../services/index");

router.use("/Admin", AdminRoutes);
router.use("/Parent", ParentRoutes);
router.use("/Tutor", TutorRoutes);
router.use("/Payment", PaymentRoutes);
router.use("/upload", uploadRoutes);

module.exports = router;
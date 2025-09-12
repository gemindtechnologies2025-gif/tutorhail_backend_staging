const router = require("express").Router();
const ParentRoutes = require("./Parent");
const TutorRoutes = require("./Tutor");
const AdminRoutes = require("./Admin");
const uploadRoutes=require("./Upload");
const PaymentRoutes = require("./Payment");
const services = require("../../services/index");

router.use("/Admin", services.CryptoEncypt.decryptInput, AdminRoutes);
router.use("/Parent", services.CryptoEncypt.decryptInput, ParentRoutes);
router.use("/Tutor", services.CryptoEncypt.decryptInput, TutorRoutes);
router.use("/Payment", PaymentRoutes);
router.use("/upload", uploadRoutes);

module.exports = router;
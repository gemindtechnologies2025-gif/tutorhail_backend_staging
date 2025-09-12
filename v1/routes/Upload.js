const router = require("express").Router();
const {upload, s3UploadMiddleware, s3MultiUploadMiddleware} = require("../../services/uploadServices");
const Controller = require('../controller/index');

router.post('/uploadFile', upload.single("file"), s3UploadMiddleware, Controller.UploadController.uploadFile);
router.post('/uploadFiles', upload.array('file'), s3MultiUploadMiddleware,Controller.UploadController.uploadManyFile);

module.exports = router;
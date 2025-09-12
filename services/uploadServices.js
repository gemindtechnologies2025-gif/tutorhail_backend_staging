
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require('multer');
const { Readable } = require('stream');
// Initialize the S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
    }
});
const deleteFileIfExists = async (bucket, key) => {
    try {
        const deleteParams = {
            Bucket: bucket,
            Key: key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
        console.log("Previous image deleted successfully.");
    } catch (err) {
        if (err.name !== 'NoSuchKey') {
            console.log("Error deleting the image:", err.message);
        } else {
            console.log("Image not found, proceeding with upload.");
        }
    }
};
const multerS3Storage = multer.memoryStorage();
const upload = multer({
    storage: multerS3Storage
});
const s3UploadMiddleware = async (req, res, next) => {
    if (!req.file) {
        return next();
    }
    const bucket = process.env.AWS_BUCKET;
    const key = Date.now() + "-" + req.file.originalname;
    // Delete existing file if it exists
    await deleteFileIfExists(bucket, key);
    const stream = Readable.from(req.file.buffer);
    const uploadParams = {
        client: s3Client,
        params: {
            Bucket: bucket,
            Key: key,
            Body: stream,
            ACL: 'public-read'
        }
    };
    const uploader = new Upload(uploadParams);
    try {
        let data = await uploader.done();
        req.file.location = data.Location;
        next();
    } catch (error) {
        console.error("Error uploading file:", error.message);
        next(error);
    }
};
const s3MultiUploadMiddleware = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return next();
    }
    const bucket = "tutorhail";
    const uploadPromises = req.files.map(async file => {
        const key = Date.now() + "-" + file.originalname;
        try {
            // Delete existing file if it exists
            await deleteFileIfExists(bucket, key);
            const stream = Readable.from(file.buffer);
            const uploadParams = {
                client: s3Client,
                params: {
                    Bucket: bucket,
                    Key: key,
                    Body: stream,
                    ACL: 'public-read'
                }
            };
            const uploader = new Upload(uploadParams);
             await uploader.done();
            file = `${process.env.CDN_URL}/${key}`;
            return file;
        } catch (error) {
            console.error("Error uploading file:", error.message);
            return Promise.reject(error);
        }
    });
    try {
        const uploadedFiles = await Promise.all(uploadPromises);
        req.files = uploadedFiles; // Assign uploaded files back to req.files
        next();
    } catch (error) {
        next(error); // Pass error to Express error handler
    }
};
module.exports = {
    upload,
    s3UploadMiddleware,
    s3MultiUploadMiddleware
};
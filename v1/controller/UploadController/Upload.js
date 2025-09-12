const axios = require("axios");
const constants = require("../../../common/constants");
const aws = require("aws-sdk");

aws.config.update({
    secretAccessKey: process.env.AWS_SECRET,
    accessKeyId: process.env.AWS_KEY
});
let s3 = new aws.S3();

async function check(url) {
    try {
        let res = await axios.get(url, {
            headers: {
                'content-type': 'application/json'
            }
        });
        return res;
    } catch (error) {
        console.error(error.message || error);
        return true;
    }
}
module.exports.checkImage = async (req, res, next) => {
    try {
        let requestUrl = req.body.url;
        let data = check(requestUrl);
        if (data) {
            throw new Error("Invalid Url");
        } else {
            return res.success("Good Url");
        }
    } catch (error) {
        next(error);
    }
};
module.exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) throw new Error(constants.MESSAGES.UPLOADING_ERROR);
        const filePath = req.file;
        const image = filePath.location;
        return res.success(constants.MESSAGES.IMAGE_UPLOADED, {
            image
        });
    } catch (error) {
        next(error);
    }
};
module.exports.uploadManyFile = async (req, res, next) => {
    try {
        if (!req.files) throw new Error(constants.MESSAGES.UPLOADING_ERROR);
        const filePath = req.files;
        return res.success(constants.MESSAGES.IMAGE_UPLOADED, {
            filePath
        });
    } catch (error) {
        next(error);
    }
};
module.exports.removeImage = async (req, res, next) => {
    try {
        let name = `${req.body.name}.${req.body.ext}`;
        s3.deleteObject({
            bucket: process.env.AWS_BUCKET,
            Key: name
        }, function (err, data) {
            if (err) {
                throw new Error(constants.MESSAGES.IMAGE_NOT_FOUND);
            }
            return res.success(constants.MESSAGES.IMAGE_REMOVED, data);
        });
    } catch (error) {
        next(error);
    }
};
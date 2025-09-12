//Using Crypto
const crypto = require('crypto');
const algorithm = process.env.ALGORITHM;
const ivKey = process.env.IV;

//Using CryptoJs
const CryptoJS = require("crypto-js");
const iv = CryptoJS.enc.Base64.parse(process.env.IV); 
const key = CryptoJS.SHA256(process.env.KEY);

const moment = require("moment");

module.exports.encyptInput = async (data) => {
    if ((data.deviceType).toLowerCase() == "web") {
        let encryptedString;
        if (typeof data.payload == "string") {
            data.payload = data.payload.slice();
            encryptedString = CryptoJS.AES.encrypt(data.payload, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC
            });
        } else {
            encryptedString = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
                iv: iv,
                mode: CryptoJS.mode.CBC
            });
        }
        return {
            iv: iv.toString(),
            hash: encryptedString.toString()
        };
    } else {

        let appkey = data.appkey;
        const key = crypto.randomBytes(32);
        let cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'base64'), ivKey);
        let encrypted = cipher.update(appkey);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return {
            iv: ivKey.toString('hex'),
            sek: encrypted.toString('hex'),
            hash: key.toString('hex')
        };
    }
};
module.exports.decryptInput = async (req, res, next) => {
    if(req.headers.appid == process.env.APP_KEY || req.originalUrl.includes("zendeskLogin"))
    next();
    else{
    if (!req.headers.devicetype || !req.headers.hash) {
        return res.status(429).send({
            "statusCode": 429,
            "message": "ACCESS BLOCKED",
            "data": {},
            "status": 0,
            "isSessionExpired": true
        });
    }
    if ((req.headers.devicetype).toLowerCase() == "webapp") {
        let hash = req.headers.hash;
        let decrypted = CryptoJS.AES.decrypt(hash, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        let decryptedData = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
        decrypted = Number(decryptedData.date);
        if (moment(decrypted) == "Invalid date" || moment().diff(moment(decrypted), "s") >= 10 || moment().diff(moment(decrypted), "s") == isNaN) {
            return res.status(429).send({
                "statusCode": 429,
                "message": "BLOCKED ACCESS",
                "data": {},
                "status": 0,
                "isSessionExpired": true
            });
        }
        req.headers = decryptedData;
        if (Object.keys(req.body).length > 0) {
            if(!req.body.hash){
                return res.status(429).send({
                    "statusCode": 429,
                    "message": "ACCESS BLOCKED",
                    "data": {},
                    "status": 0,
                    "isSessionExpired": true
                });
            }
            let bodyHash = req.body.hash;
            let decryptedBody = CryptoJS.AES.decrypt(bodyHash, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            let decryptedBodyData = JSON.parse(decryptedBody.toString(CryptoJS.enc.Utf8));
            req.body = decryptedBodyData;
        }
        next();
    } else if ((req.headers.devicetype).toLowerCase() == "ios" || (req.headers.devicetype).toLowerCase() == "android" || (req.headers.devicetype).toLowerCase() == "web") {
        if (!req.headers.hash || !req.headers.sek) {
            return res.status(429).send({
                "statusCode": 429,
                "message": "ACCESS BLOCKED",
                "data": {},
                "status": 0,
                "isSessionExpired": true
            });
        }
        let hash = req.headers.hash;
        let sek = req.headers.sek;
        let key = Buffer.from(sek, 'hex');
        hash = Buffer.from(hash, 'hex');
        let decipher = crypto.createDecipheriv(algorithm, Buffer.from(hash, 'base64'), ivKey);
        let decrypted = decipher.update(key);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        decrypted = JSON.parse(decrypted.toString());
        if(!decrypted.appKey){
            return res.status(429).send({
                "statusCode": 429,
                "message": "ACCESS BLOCKED",
                "data": {},
                "status": 0,
                "isSessionExpired": true
            });
        }
        let decryptedDate = (decrypted.appKey);
        if (moment(decryptedDate).toString() == "Invalid date" || moment().diff(moment(decryptedDate), "s") >= 10 || moment().diff(moment(decryptedDate), "s") == isNaN) {
            return res.status(429).send({
                "statusCode": 429,
                "message": "BLOCKED ACCESS",
                "data": {},
                "status": 0,
                "isSessionExpired": true
            });
        }
        req.headers = decrypted;
        if (Object.keys(req.body).length > 0) {
            let hashBody = req.body.hash;
            let sekBody = req.body.sek;
            let keyBody = Buffer.from(sekBody, 'hex');
            hashBody = Buffer.from(hashBody, 'hex');
            decipher = crypto.createDecipheriv(algorithm, Buffer.from(hashBody, 'base64'), ivKey);
            decrypted = decipher.update(keyBody);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            decrypted = JSON.parse(decrypted.toString());
            req.body = decrypted;
        }
        next();
    } else{
        return res.status(429).send({
            "statusCode": 429,
            "message": "ACCESS BLOCKED",
            "data": {},
            "status": 0,
            "isSessionExpired": true
        });
    }
}
};
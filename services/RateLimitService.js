const rateLimit = require("express-rate-limit");

module.exports.globalLimiter = rateLimit({
    windowMs: 60000, // 1 Minute in milliseconds
    max: 5, // limit each IP to 10 requests per Minute
    message: {
        "statusCode": 429,
        "message": "Too many requests, please try again later.",
        "data": {},
        "status": 0,
        "isSessionExpired": false
    },
    headers: true,
    keyGenerator: function (req) {
        return req.headers["x-forwarded-for"];
    },
    handler: function (req, res) {
        return res.status(429).send({
            statusCode: 429,
            message: "Too many requests, please try again later.",
            data: {},
            status: 0,
            isSessionExpired: true
        });
    }
});
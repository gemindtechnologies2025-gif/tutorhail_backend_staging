const jwt = require("jsonwebtoken");
const Model = require("../models");

//Get auth token from jwt.
module.exports.getToken = (data) =>
  jwt.sign(data, process.env.SECRET_KEY, {
    expiresIn: "30 days"
  });

//Get temp auth token valid for 2hrs.
module.exports.getVerifyToken = (data) =>
  jwt.sign(data, process.env.SECRET_KEY, {
    expiresIn: "2h"
  });

//Verify auth token using jwt.
module.exports.verifyToken = (token) =>
  jwt.verify(token, process.env.SECRET_KEY);

//Verify auth using jti and _id using jwt.
module.exports.verify = (...args) => async (req, res, next) => {
  try {
    let roles = [].concat(args).map((role) => role.toLowerCase());
    const token = String(req.headers.authorization || "")
      .replace(/bearer|jwt|Guest/i, "")
      .trim();

    if (roles.includes("guestuser")) {
      if (token != null && token != 'null' && token != undefined && token != "") {
        roles = "user";
      } else {
        return next();
      }
    }

    let doc = null;
    let role = "";
    const decoded = this.verifyToken(token);
  
    if (decoded != null && roles.includes("user")) {
      role = "user";
      doc = await Model.User.findOne({
        _id: decoded._id,
        isBlocked: false,
        //jti: decoded.jti,
        isDeleted: false
        //deviceId: decoded.secretId
      });
    }
    if (decoded != null && roles.includes("admin") || roles.includes("subadmin")) {
      role = "admin";
      doc = await Model.Admin.findOne({
        _id: decoded._id,
        isBlocked: false,
        jti: decoded.jti,
        isDeleted: false
        //deviceId: decoded.secretId
      });
    }
    if (!doc) {
      return res.status(401).send({
        "statusCode": 401,
        "message": "UNAUTHORIZED ACCESS",
        "data": {},
        "status": 0,
        "isSessionExpired": true
      });
    }
    if (role) req[role] = doc.toJSON();
    next();
  } catch (error) {
    console.error(error);
    const message =
      String(error.name).toLowerCase() == "error" ?
      error.message :
      "Session expired, please login again";
    return res.error(401, message);
  }
};
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');
const constants =  require('../common/constants');

const adminSchema = new Schema({
    email: {
        type: String,
        default: "",
        lowercase: true,
        index: true
    },
    phoneNo: {
        type: String,
        default: "",
        index: true
    },
    dialCode: {
        type: String,
        default: "",
        index: true
    },
    countryISOCode: {
        type: String,
        default: ""
    },
    socketId: {
        type: String
    },
    password: {
        type: String,
        default: ""
    },
    firstName: {
        type: String,
        default: ""
    },
    lastName: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    loginCount: {
        type: Number,
        default: 0
    },
    jti: {
        type: String,
        default: "",
        index: true
    },
    deviceType: {
        type: String,
        enum: Object.values(constants.DEVICETYPE)
      },
    deviceToken: {
        type: String,
        default: "",
        index: true
      }
}, {
    timestamps: true
});
adminSchema .set("toJSON", {
    getters: true,
    virtuals: true
});

adminSchema.methods.authenticate = function (password, callback) {
    const promise = new Promise((resolve, reject) => {
      if (!password) reject(new Error("MISSING_PASSWORD"));
      bcrypt.compare(password, this.password, (error, result) => {
        if (!result) {
          reject(new Error("Invalid Password"));
        }
        resolve(this);
      });
    });
  
    if (typeof callback != "function") return promise;
    promise
      .then((result) => callback(null, result))
      .catch((err) => callback(err));
  };
  
  adminSchema .methods.setPassword = async function (password) {
    let hashPwd = await bcrypt.hash(password, 10);
    this.password = hashPwd;
    return this;
  };

module.exports = mongoose.model("Admins", adminSchema );
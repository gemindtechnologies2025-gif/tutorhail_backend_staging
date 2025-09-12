const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const constants = require('../common/constants');

let parentSchema = new Schema({
  name: {
    type: String,
    default: ""
  },
  bioMetricId: {
    type: String,
    default: ""
  },
  email: {
    type: String,
    default: "",
    trim: true,
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
  gender: {
    type: String,
    enum: Object.values(constants.GENDER)
  },
  image: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  isNotification: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  isSocialLogin: {
    type: Boolean,
    default: false
  },
  appleId: {
    type: String,
    default: "",
    index: true
  },
  googleId: {
    type: String,
    default: "",
    index: true
  },
  linkedInId: {
    type: String,
    default: "",
    index: true
  },
  microsoftId: {
    type: String,
    default: "",
    index: true
  },
  jti: {
    type: String,
    default: "",
    select: false,
    index: true
  },
  type: {
    type: Number,
    enum: Object.values(constants.CUSTOMER_TYPE),
    default: constants.CUSTOMER_TYPE.PARENT
  },
  deviceDetails: [
    {
      deviceToken: {
        type: String,
        default: ""
      },
      deviceType: {
        type: String,
        enum: Object.values(constants.DEVICETYPE)
      },
      sessionId:  {
        type: String,
        default: ""
      }
    }],
  loginCount: {
    type: Number,
    default: 0
  },
  password: {
    type: String,
    default: ""
  },
  isPasswordSet: {
    type: Boolean,
    default:false
  },
  isProfileComplete: {
    type: Boolean,
    default:false
  },
  profileCompletedAt : {
    type: Number,
    default: 0
   },
  isOnline: {
    type: Boolean,
    default:false
  },
  longitude: {
    type: Number,
    default: 0
  },
  latitude: {
    type: Number,
    default: 0
  },
  location: {
    type: {
      type: String,
      default: "Point"
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  deletedAt: {
    type: String
  },
  timezone: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

parentSchema.methods.authenticate = function (password, callback) {
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

parentSchema.methods.setPassword = async function (password) {
  let hashPwd = await bcrypt.hash(password, 10);
  this.password = hashPwd;
  this.set({
    isPasswordSet : true
  });
  return this;
};
parentSchema.pre(/save|create|update/i, function (next) {
  if (this.get("latitude") && this.get("longitude")) {
    const longitude = this.get("longitude");
    const latitude = this.get("latitude");
    const location = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };
    this.set({
      location
    });
  }
  next();
});

module.exports = mongoose.model('Parent', parentSchema);
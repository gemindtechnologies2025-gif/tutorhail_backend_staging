const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const constants = require('../common/constants');

let userSchema = new Schema({
  name: { type: String, default: "", index: true },
  userName: { type: String, default: "", index: true },
  role: { type: Number, enum: Object.values(constants.APP_ROLE) },
  secondaryRole: { type: Number, enum: Object.values(constants.APP_ROLE) },
  bioMetricId: { type: String, default: "" },
  email: { type: String, default: "", trim: true, lowercase: true, index: true },
  phoneNo: { type: String, default: "", index: true },
  dialCode: { type: String, default: "", index: true },
  countryISOCode: { type: String, default: "" },
  gender: { type: String, enum: Object.values(constants.GENDER) },  
  age: { type: String, default: "" },
  image: { type: String, default: "" },
  shortBio: { type: String, default: "" },
  address: { type: String, default: "" },
  isNotification: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  isSocialLogin: { type: Boolean, default: false },
  appleId: { type: String, default: "", index: true },
  googleId: { type: String, default: "", index: true },
  linkedInId: { type: String, default: "", index: true },
  microsoftId: { type: String, default: "", index: true },
  jti: { type: String, default: "", select: false, index: true },
  tutorStatus: { type: Number, enum: Object.values(constants.TUTOR_STATUS), default: constants.TUTOR_STATUS.PENDING },
  documentVerification: { type: Boolean, default: false },
  tutorAcceptedAt: { type: Date, default: null },
  tutorRejectedAt: { type: Date, default: null },
  rejectReason: { type: String, default: "" },
  followers: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0 },
  giftsEarn: { type: Number, default: 0 },
  classEarn: { type: Number, default: 0 },
  oneOnOneEarn: { type: Number, default: 0 },
  totalEarn: { type: Number, default: 0 },
  bookCount: { type: Number, default: 0 },
  withdrawAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  deviceDetails: [{
      deviceToken: { type: String, default: "" },
      deviceType: { type: String, enum: Object.values(constants.DEVICETYPE) },
      sessionId: { type: String, default: "" }
    }],
  loginCount: { type: Number, default: 0 },
  password: { type: String, default: "" },
  isPasswordSet: { type: Boolean, default: false },
  isProfileComplete: { type: Boolean, default: false },
  profileCompletedAt: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isOnline: { type: Boolean, default: false },
  isBookLogin: { type: Boolean, default: false },
  bannerImg: { type: String, default: "" },
  longitude: { type: Number, default: 0 },
  latitude: { type: Number, default: 0 },
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
  deletedAt: { type: Date },
  timezone: { type: String, default: "" }
}, {
  timestamps: true
});

userSchema.methods.authenticate = function (password, callback) {
  const promise = new Promise((resolve, reject) => {
    if (!password) reject(new Error("MISSING_PASSWORD"));
    bcrypt.compare(password, this.password, (error, result) => {
      if (!result) reject(new Error("Invalid Password"));
      resolve(this);
    });
  });
  if (typeof callback !== "function") return promise;
  promise.then(result => callback(null, result)).catch(err => callback(err));
};

userSchema.methods.setPassword = async function (password) {
  const hashPwd = await bcrypt.hash(password, 10);
  this.password = hashPwd;
  this.set({ isPasswordSet: true });
  return this;
};

userSchema.pre(/save|create|update/i, function (next) {
  if (this.get("latitude") && this.get("longitude")) {
    const longitude = this.get("longitude");
    const latitude = this.get("latitude");
    const location = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };
    this.set({ location });
  }
  next();
});

userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);

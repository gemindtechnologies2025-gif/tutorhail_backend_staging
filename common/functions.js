const _ = require("lodash");
const Handlebars = require("handlebars");
const axios = require('axios');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
      credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

//Helper functions
module.exports.toHex = (val) => Buffer.from(val, "utf8").toString("hex");
module.exports.toStr = (val) => Buffer.from(val, "hex").toString("utf8");

module.exports.generateRandomCustom = (length) => {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};
module.exports.generateRandomStringAndNumbers = function (len) {
    let text = _.times(len, () => _.random(35).toString(36)).join('');
    return text;
};
module.exports.generateNumber = function (len) {
    let text = _.random(10 ** len, 9 ** len);
    return text;
};
module.exports.setPrecision = async (no, precision) => {
    precision = precision || 2;
    if (!isNaN(no)) {
        return (+(Math.round(+(no + 'e' + precision)) + 'e' + -precision)).toFixed(precision);
    }
    return 0;
};
module.exports.prettyCase = (str) => {
    if (typeof str == "string" && /^[A-Z_]+$/.test(str)) {
        str = _.lowerCase(str);
        str = _.startCase(str);
    }
    return str;
};
module.exports.toDecimals = (val, decimal = 2) => {
    const base = Math.pow(10, decimal);
    return Math.round(val * base) / base;
};

module.exports.generateBookingId = () => {
    const prefix = "TH";
    const characters = '0123456789';
    let randomPart = '';
    
    for (let i = 0; i < 7; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomPart += characters[randomIndex];
    }
    return prefix + randomPart;
};

module.exports.generateInvoiceString = () => {
    const prefix = "THIN";
    const characters = '0123456789';
    let randomPart = '';
    
    for (let i = 0; i < 7; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomPart += characters[randomIndex];
    }
    return prefix + randomPart;
};

//Render function to frame message and title for notifications
module.exports.renderTemplateField = async (inputKeysObj, values, lang, payloadData) => {
    lang = lang || "en";
    let sendObj = {};
    sendObj.tutorId = payloadData.tutorId ? payloadData.tutorId : null;
    sendObj.parentId = payloadData.parentId ? payloadData.parentId : null;
    sendObj.adminId = payloadData.adminId ? payloadData.adminId : null;
    sendObj.receiverId = payloadData.receiverId ? payloadData.receiverId : null;
    sendObj.contentId = payloadData.values?.contentId ?? null;
    sendObj.classId = payloadData.values?.classId ?? null;
    sendObj.bookingId = payloadData.values?.bookingId ?? null;
    sendObj.bookingDetailId = payloadData.values?._id ?? null;
    sendObj.startTime = payloadData.values?.startTime ?? null;  
    sendObj.endTime = payloadData.values?.endTime ?? null;
    sendObj.bookingStatus = payloadData.values?.bookingStatus ?? null;
    sendObj.query = payloadData.query ? payloadData.query : "";
    sendObj.revertQuery = payloadData.revertQuery ? payloadData.revertQuery : "";
    sendObj.role = payloadData.role;
    sendObj.isNotificationSave = payloadData.isNotificationSave ? payloadData.isNotificationSave : false;
    sendObj.pushType = payloadData.pushType ? payloadData.pushType : 0;
    if (values) values = JSON.parse(JSON.stringify(values));
    let keys = inputKeysObj.keys || [];
    for (let i = 0; i < keys.length; i++) {
      keys[i].value = values[keys[i].key];
    }
    let source = inputKeysObj.message[lang] || null;
    let template = Handlebars.compile(source) || null;
    let message = template(values) || payloadData.message;
    source = inputKeysObj.title[lang] || null;
    template = Handlebars.compile(source) || null;
    let title = template(values) || payloadData.title;
    sendObj.message = message;
    sendObj.title = title;
    sendObj.keys = keys;
    sendObj.data = values;
    return sendObj;
  };

module.exports.generatePassword = () => {
  // Define character sets
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  // Ensure the password has at least one character from each required set
  const password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];
  // Fill the remaining spots in the password to reach the desired length
  const allCharacters = upper + lower + digits + special;
  const remainingLength = 8 - password.length;

  for (let i = 0; i < remainingLength; i++) {
    password.push(allCharacters[Math.floor(Math.random() * allCharacters.length)]);
  }
  // Shuffle the resulting array to ensure randomness
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }
  // Convert the array to a string and return it
  return password.join('');
};

module.exports.generatePromoCodeName = (tutorName) => {
  const prefix = tutorName.trim().slice(0, 2).toUpperCase();
  const characters = '0123456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomPart += characters[randomIndex];
  }
  return prefix + randomPart; 
};

module.exports.convertCurrency = async (amount, currency) => {
  try {
    const BASE_CURRENCY = currency;
    const TARGET_CURRENCY = 'USD';
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${process.env.CURRENCY_API_KEY}/latest/${BASE_CURRENCY}`);
    const rate = response.data.conversion_rates[TARGET_CURRENCY];
    const convertedAmount = amount * rate;

    console.log(convertedAmount, "CONVERTED AMOUNT");
    console.log(`${amount} ${BASE_CURRENCY} = ${convertedAmount.toFixed(2)} ${TARGET_CURRENCY}`);
    return convertedAmount;
  } catch (error) {
    console.error('Currency conversion error:', error.response?.data || error.message);
  }
};


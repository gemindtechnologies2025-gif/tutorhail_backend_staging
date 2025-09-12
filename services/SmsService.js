const twilio = require("twilio");

let accountSid = process.env.TWILIO_SID;
let authToken = process.env.TWILIO_AUTH;
let serviceId = process.env.TWILIO_VID;
const client = twilio(accountSid, authToken, { lazyLoading: true });

//SEND otp
exports.sendPhoneVerification =  async(payload) => {
client.verify.v2.services(serviceId)
.verifications
.create({to: payload.dialCode + (payload.phoneNo ? payload.phoneNo.toString() : ""),channel: 'sms'})
.then(verification => console.log(verification.sid));
};

exports.verifyOtp = async (payload) => {
    try {
        // Verify OTP
        const verificationCheck = await client.verify.v2.services(serviceId)
            .verificationChecks
            .create({
                to: payload.dialCode + (payload.phoneNo ? payload.phoneNo.toString() : ""), 
                code: payload.otp
            });

        // Handle different statuses (optional)
        if (verificationCheck.status === "approved") {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        if (error.moreInfo) {
            console.error("More Info:", error.moreInfo);
        }
        throw error;
    }
};

const {
  RtcTokenBuilder,
  RtcRole
} = require('agora-access-token');

const APP_ID =  process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

async function generateRTCToken(bookingDetailId) {
  try {

    const channelName = bookingDetailId;
    if (!channelName) {
      throw new Error("Channel name is required");
    }
    // const uid = body.uid;
    // if (!uid || uid === '') {
    //     throw new Error("Uid is required");
    // }

    let role = RtcRole.SUBSCRIBER;
    // if (body.userRole === 'publisher') {
    //   role = RtcRole.PUBLISHER;
    // } else if (body.userRole === 'audience') {
    //   role = RtcRole.SUBSCRIBER;
    // } else {
    //    throw new Error("Role is incorrect");
    // }

    // const expireTime = expiryTime ? parseInt(body.expiryTime, 10) : 3600; // default expiry time = 1 hour
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    let token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, 0, role, privilegeExpireTime);
    // if (body.tokenType === 'userAccount') {
    //   token = RtcTokenBuilder.buildTokenWithAccount(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    // } else if (body.tokenType === 'uid') {
    //   token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    // } else {
    //     throw new Error("Invalid token");
    // }
    return token;
  } catch (error) {
    console.log(error, "error");
  }
}

module.exports = {
  generateRTCToken
};
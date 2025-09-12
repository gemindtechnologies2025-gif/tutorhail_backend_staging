const functions = require("../common/functions");
const constants = require("../common/constants");

module.exports.init = async () => {
  console.log("Process Initialized");
};

process.on("sendNotification", async function (payloadData) {
  try {
    if (payloadData && payloadData.receiverId) {
      payloadData.pushType = payloadData.pushType ? payloadData.pushType : 0;
      let lang = payloadData.lang || "en";
      let role = payloadData.role;
      let notificationType = payloadData.notificationType || constants.NOTIFICATION_TYPE.PUSH;
      let values = payloadData.values ? payloadData.values : {};
      let inputKeysObj = constants.PUSH_TYPE[payloadData.pushType];
      let data = await functions.renderTemplateField(
        inputKeysObj,
        values,
        lang,
        payloadData
      );
      if (notificationType == constants.NOTIFICATION_TYPE.PUSH) {

        process.emit("preparePushNotifiction", {data, role});
      } else if (notificationType == constants.NOTIFICATION_TYPE.BROADCAST) {
        process.emit("prepareBroadcastPushNotifictions", {payloadData, role});
      }
    }
  } catch (err) {
    console.log(err);
  }
});
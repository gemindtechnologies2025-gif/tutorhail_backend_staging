const Model = require("../models/index");
const constants = require("../common/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const firebase = require('firebase-admin');
const admin = require('../common/functions').admin;

module.exports.preparePushNotifiction = preparePushNotifiction;
module.exports.prepareBroadcastPushNotifictions = prepareBroadcastPushNotifictions;

//Fetch user token and device type and prepare notification.
async function preparePushNotifiction(payloadData, userType) {
  let payload = JSON.parse(JSON.stringify(payloadData));

  let userModel, userIdField;
  if (userType === constants.ROLE.TUTOR) {
    userModel = Model.User;
    userIdField = 'tutorId';
  } else if (userType === constants.ROLE.PARENT) {
    userModel = Model.User;
    userIdField = 'parentId';
  } else if (userType === constants.ROLE.ADMIN) {
    userModel = Model.Admin;
    userIdField = 'adminId';
  } else {
    console.error("Invalid user type:", userType);
    return;
  }

  const query = { _id: ObjectId(payload[userIdField]), isDeleted: false };
  const projection = (userType === constants.ROLE.ADMIN) ? { name: 1, deviceToken: 1 } : { name: 1, deviceDetails: 1 };
  const userData = await userModel.findOne(query, projection);

  if (!userData) {
    console.error(`No user found for ${userType} with id:`, payload[userIdField]);
    return;
  }

  // Collect valid device tokens
  let tokens = [];
  if (userType === constants.ROLE.ADMIN) {
    if (userData.deviceToken && userData.deviceToken.trim() !== "") tokens.push(userData.deviceToken);
  } else {
    if (Array.isArray(userData.deviceDetails) && userData.deviceDetails.length > 0) {
      tokens = userData.deviceDetails
        .map(d => d.deviceToken)
        .filter(t => t && t.trim() !== "");
    }
  }
  if (tokens.length === 0) {
    console.error("No valid device tokens found for user:", payload[userIdField]);
    return;
  }

  let notificationDoc = null;
  if (payload.isNotificationSave === true || payload.isNotificationSave === "true") {
    notificationDoc = await Model.Notification.create(payload);
    payload.notificationId = notificationDoc._id;
  }

  for (const token of tokens) {
    try {
      await sendPushNotifiction({ ...userData, deviceToken: token }, payload, notificationDoc);
    } catch (err) {
      console.error(`Error sending notification to token: ${token}`, err);
    }
  }

  // Emit process event only once per user
  process.emit("newNotification", {
    userId: payload[userIdField],
    message: "New Notification"
  });
}
async function sendPushNotifiction(userData, payload, notificationDoc = null) {
  const registrationToken = userData.deviceToken;
  if (!registrationToken || registrationToken.trim() === "") return;

  const message = {
    notification: {
      title: payload.title || "",
      body: payload.message || ""
    },
    data: {
      title: payload.title || "",
      body: payload.message || "",
      payload: JSON.stringify(payload)
    },
    token: registrationToken
  };

  // Attach saved notification if available
  if (notificationDoc) {
    message.data.notifications = JSON.stringify(notificationDoc);
  }

  try {
    const response = await firebase.messaging().send(message);
    console.log("Notification sent successfully:", response);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
//Broadcast notification
async function sendPushDetails(payload) {
  let { tokens, title, message } = payload;
  try {
    if (!tokens || tokens.length === 0) {
      throw new Error("No device tokens provided.");
    }
    const messageData = {
      notification: {
        title: title || "Notification",
        body: message || "",
      },
      data: {
        title: title || "Notification",
        body: message || "",
      },
      tokens,
    };
    // Use sendEachForMulticast instead of sendMulticast
    const response = await firebase.messaging().sendEachForMulticast(messageData);
    console.log("Notification sent successfully:", response);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          console.error(`Error sending to token ${tokens[index]}:`, resp.error);
        }
      });
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    if (error.code === "messaging/invalid-recipient") {
      console.error("One or more tokens are invalid.");
    } else if (error.code === "messaging/server-unavailable") {
      console.error("Firebase server is temporarily unavailable.");
    }
  }
}
async function prepareBroadcastPushNotifictions(payloadData) {
  let payload = JSON.parse(JSON.stringify(payloadData));

  let userType = payload.role;

  console.log(userType, "USER TYPE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  if (payload && payload.data) delete payload.data;
  if (payload && payload.keys) delete payload.keys;

  if (userType == constants.ROLE.TUTOR || userType == constants.ROLE.ALL) {
    console.log("TUTOR >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    const deviceData = await Model.Tutor.distinct("deviceToken", {
      deviceToken: { $ne: "" },
      isDeleted: false,
    });

    if (deviceData && deviceData.length) {
      console.log(`Tutor Tokens Found: ${deviceData.length}`);
      console.log(`Tutor Tokens Found: ${deviceData.length}`);
      let dataToSend = {
        tokens: deviceData,
        title: payload.title,
        message: payload.message,
      };
      await sendPushDetails(dataToSend);
    } else {
      console.log("No tutor device data found.");
    }
  } else if (userType == constants.ROLE.PARENT || userType == constants.ROLE.ALL) {
    const deviceData = await Model.User.distinct("deviceToken", {
      // _id: {
      //   $in: payload.parentId
      // },
      //isNotification: true,
      deviceToken: {
        $ne: ""
      },
      isDeleted: false
    });
    if (deviceData && deviceData.length) {
      let dataToSend = {
        tokens: deviceData,
        title: payload.title,
        message: payload.message
      };
      sendPushDetails(dataToSend);
    } else {
      console.error("No parent device data found.");
    }
  }
}


process.on("preparePushNotifiction", async function (payloadData) {
  preparePushNotifiction(payloadData.data, payloadData.role);
});

process.on("prepareBroadcastPushNotifictions", async function (payloadData) {
  prepareBroadcastPushNotifictions(payloadData);
});

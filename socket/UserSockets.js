const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Model = require('../models/index');
const constants = require("../common/constants");
const common = require("../services/common");

module.exports = (io, socket, socketData) => {
  //Socket to connect user to a specific room.
  socket.on("joinRoom", async function (data) {
  try {
    //const { parentId, tutorId } = data;
    // if (parentId.equals(tutorId)) {
    //   throw new Error("ParentId and tutorId cannot be same");
    // }
    let connectionId;
    if (data.type == constants.CHAT_TYPE.BOOKING) {
      let checkBooking = await Model.Booking.findOne({
        _id: ObjectId(data.bookingId)
      });
      if (checkBooking == null) {
        throw new Error("Booking not found");
      }
      connectionId = data.connectionId; 
    } else if (data.type == constants.CHAT_TYPE.NORMAL) {
      connectionId = await common.findUniqueConnectId(
        data.parentId.toString(),
        data.tutorId.toString()
      );
    }
    socket.join(connectionId); 
    let dataToSend = {
      isOnline: true,
      connectionId
    };
    io.to(socketData._id).emit("joinRoomOk", {
      statusCode: 200,
      message: "Chat joined successfully",
      data: dataToSend,
      status: 1,
      isSessionExpired: false
    });
  } catch (error) {
    console.error(error.message || error);
    io.to(socketData._id).emit("errorSocket", {
      statusCode: 400,
      message: error.message || error,
      data: {},
      status: 1,
      isSessionExpired: false
    });
  }
});

  //Socket to leave user from a specific room.
  socket.on("leaveRoom", async function (data) {
    try {
      if (data && data.connectionId != null) {
        socket.leave(data.connectionId);
        let dataToSend = {
          isOnline: false
        };
        io.to(socketData._id).emit("leaveRoomOk", {
          statusCode: 200,
          message: "Chat leaved successfully",
          data: dataToSend,
          status: 1,
          isSessionExpired: false
        });
      }
    } catch (error) {
      console.error(error.message || error);
      io.to(socketData._id).emit("errorSocket", {
        statusCode: 400,
        message: error.message || error,
        data: {},
        status: 1,
        isSessionExpired: false
      });
    }
  });
  //Socket to send message to stylist
  socket.on("send_message_user", async (data) => {
  try {
    //const { parentId, tutorId } = data;
    // if (parentId.equals(tutorId)) {
    //   throw new Error("ParentId and tutorId cannot be same");
    // }
    if (!data.connectionId) return;
    const lastChat = await Model.ChatMessage.findOne({ connectionId: data.connectionId })
      .sort({ createdAt: -1 })
      .select("isTutorBlocked isParentBlocked");

    if (lastChat) {
      if (data.sentBy === constants.APP_ROLE.PARENT && lastChat.isTutorBlocked) {
        throw new Error("You have blocked this tutor. Messaging is not allowed.");
      }
      if (data.sentBy === constants.APP_ROLE.TUTOR && lastChat.isParentBlocked) {
        throw new Error("You have blocked this parent. Messaging is not allowed.");
      }
    }

    if (data.type == constants.CHAT_TYPE.BOOKING) {
      const checkBooking = await Model.Booking.findById(data.bookingId)
        .populate("parentId", "name image")
        .populate("tutorId", "name image")
        .lean();

      if (!checkBooking) throw new Error("Booked lesson not found");
      checkBooking.connectionId = data.connectionId; 
    }

    const chatObj = {
      parentId: data.sentBy === constants.APP_ROLE.PARENT ? socketData._id : data.parentId,
      tutorId: data.sentBy === constants.APP_ROLE.TUTOR ? socketData._id : data.tutorId,
      sentBy: data.sentBy,
      message: data.message,
      connectionId: data.connectionId,
      bookingId: data.bookingId,
      uploadType: data.uploadType,
      uploads: data.uploads
    };

    let message = await Model.ChatMessage.create(chatObj);

    const roomId = data.connectionId.toString();
    const roomJoins = io.sockets.adapter.rooms.get(roomId);

    const isParent = data.sentBy === constants.APP_ROLE.PARENT;
    const receiverId = isParent ? data.tutorId : data.parentId;
    const readField = isParent ? "isTutorRead" : "isParentRead";

    io.to(receiverId.toString()).emit("listMessageOk", { message: "New Message Received" });

    if (roomJoins && roomJoins.size > 1) {
      await Model.ChatMessage.findByIdAndUpdate(message._id, { $set: { [readField]: true } });
      io.to(socketData._id.toString()).emit("messageReadReceipt", {
        messageId: message._id,
        [readField]: true
      });
    }

    if (roomJoins && roomJoins.size === 1) {
      process.emit("sendNotification", {
        receiverId,
        values: message,
        role: isParent ? constants.ROLE.TUTOR : constants.ROLE.PARENT,
        isNotificationSave: false,
        pushType: constants.PUSH_TYPE_KEYS.MESSAGE_SENT,
        ...(isParent ? { tutorId: receiverId } : { parentId: receiverId })
      });
    }
    message = await Model.ChatMessage.findById(message._id)
      .populate("parentId", "name image")
      .populate("tutorId", "name image")
      .populate("bookingId", "bookingStatus parentId tutorId bookingNo");

    io.to(roomId).emit("send_message_Ok", {
      statusCode: 200,
      message: "New Message Received",
      data: message,
      status: 1,
      isSessionExpired: false
    });
  } catch (error) {
    console.error(error.message || error);
    io.to(socketData._id).emit("errorSocket", {
      statusCode: 400,
      message: error.message || error,
      data: {},
      status: 1,
      isSessionExpired: false
    });
  }
});


  socket.on("videoChat", async function (data) {
    try {
      if(data.videoToken) {
        if (data.videoToken == null) {
          throw new Error("Token not found");
        }
        socket.join(data.videoToken);
        let dataToSend = {
          isOnline: true
        };
        io.to(socketData._id).emit("joinVideoChat", {
          statusCode: 200,
          message: "Video Call joined successfully",
          data: dataToSend,
          status: 1,
          isSessionExpired: false
        });
      }
    } catch (error) {
      console.error(error.message || error);
      io.to(socketData._id).emit("errorSocket", {
        statusCode: 400,
        message: error.message || error,
        data: {},
        status: 1,
        isSessionExpired: false
      });
    }
  });

  // ------------------- TUTOR STATUS WATCH -------------------
  socket.on("joinTutorStatusRoom", () => {
    socket.join("watchTutorStatus");
  });

  socket.on("leaveTutorStatusRoom", () => {
    socket.leave("watchTutorStatus");
  });

  socket.on("updateTutorStatus", async (data) => {
    try {
      const tutorId = socketData._id;
      const isOnline = data?.isOnline ?? false;
      
      await Model.User.findByIdAndUpdate(tutorId, { isOnline });
      io.to("watchTutorStatus").emit("tutorStatusUpdate", { tutorId, isOnline });
    } catch (error) {
      console.error(error.message || error);
    }
  });
};

const Auth = require("../common/authenticate");
const user = require("./UserSockets");
const constants = require("../common/constants");
const Model = require('../models/index');
let users = {};

module.exports = io => {
  io.use(async (socket, next) => {
    if (socket.handshake.query && socket.handshake.query.token) {
      let decoded = Auth.verifyToken(socket.handshake.query.token);
      if (!decoded) return next(new Error("Authentication error"));

      let role = decoded.role;
      if (decoded.role == 'parent') {
        decoded = await Model.User.findOne({
          _id: decoded._id,
          isBlocked: false,
          isDeleted: false,
          role: constants.APP_ROLE.PARENT
        });
      } else if (decoded.role == 'tutor') {
        decoded = await Model.User.findOne({
          _id: decoded._id,
          isBlocked: false,
          isDeleted: false,
          role: constants.APP_ROLE.TUTOR
        });
      }

      if (!decoded) return next(new Error("Authentication error"));

      decoded.role = role;
      users[String(socket.id)] = decoded;

      socket.join(String(decoded._id));
      socket.emit("connected", { status: true });
      next();
    } else {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", async socket => {
    let socketData = users[String(socket.id)];
    console.log("Connected User:", socketData);

    user(io, socket, socketData);

    socket.on("disconnect", async () => {
      console.log("Disconnected:", socket.id, socket.rooms);

      if ([constants.ROLE.TUTOR, constants.ROLE.PARENT].includes(socketData.role)) {
        await Model.User.updateOne(
          { _id: socketData._id },
          { $set: { isOnline: false } }
        );
      }
    });
  });

  process.on("newClass", payload => {
    io.to(String(payload.tutorId)).emit("newClass", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("newNotification", payload => {
    io.to(String(payload.userId)).emit("newNotification", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("payment", payload => {
    io.to(String(payload.parentId)).emit("payment_ok", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("withdrawRequest", payload => {
    io.to(String(payload.adminId)).emit("withdrawRequest", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("rating", payload => {
    io.to(String(payload.parentId)).emit("rating", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("readMessage", payload => {
    io.to(String(payload.userId)).emit("readMessage", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("readMessageCount", payload => {
    io.to(String(payload.userId)).emit("readMessageCount", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("readNotificationCount", payload => {
    io.to(String(payload.userId)).emit("readNotificationCount", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("joinCallParent", payload => {
    io.to(String(payload.parentId)).emit("joinCallParent", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });

  process.on("joinCallTutor", payload => {
    io.to(String(payload.tutorId)).emit("joinCallTutor", {
      statusCode: 200,
      message: "Success",
      data: payload,
      status: 1,
      isSessionExpired: false
    });
  });
};

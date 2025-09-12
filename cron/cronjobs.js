const mongoose = require("mongoose");
const Agenda = require("agenda");
const CronJob = require('cron').CronJob;
const moment = require("moment");
const tutor = require("../v1/controller/TutorController/Tutor");
const Model = require("../models/index");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("../common/constants");

//Agenda initialization.
let agenda;
agenda = new Agenda({
  mongo: mongoose.connection
});

module.exports.startCronJobs = async () => {
  console.log("Agenda Started");
  await agenda.start();
  this.createInvoice.start();
};
//Cron
module.exports.createInvoice = new CronJob('*/1 * * * *', async function () {
  try {
    console.log("CRON Started--------------- every 1 min");
    tutor.refundAmountCron();
  } catch (error) {
    console.error("Error in CRON job:", error);
  }
});

agenda.define("notificationBefore30minutes", async (job) => {
  let jobData = job.attrs.data;

  try {
    let bookingDetails = await Model.BookingDetails.findOne({
      _id: ObjectId(jobData._id)
    });

    let booking = await Model.Booking.findOne({
      _id: bookingDetails.bookingId
    });

    if (bookingDetails && booking) {
      const currentTime = moment();
      const startTime = moment(bookingDetails.startTime);
      const minutesUntilStart = startTime.diff(currentTime, 'minutes');

      // Ensure we are 30 minutes before startTime
      if (minutesUntilStart <= 30 && minutesUntilStart > 0) {
        if (bookingDetails.bookingStatus === constants.BOOKING_STATUS.PENDING && bookingDetails.pairingType == constants.PAIRING_TYPE.PENDING) {

          // Send notification to tutor
          process.emit("sendNotification", {
            tutorId: booking.tutorId,
            receiverId: booking.tutorId,
            bookingId: booking._id,
            values: booking,
            role: constants.ROLE.TUTOR,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.BEFORE_BOOKING_START
          });

          // Send notification to parent
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            bookingId: booking._id,
            values: booking,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.BEFORE_BOOKING_START
          });
        }
      }
    } 
  } catch (error) {
    console.error("Error in sending notifications:", error);
  }

  // Remove the job after execution
  job.remove(function (err) {
    if (!err)
      console.log("Successfully removed job from collection");
    else
      console.error("Error removing job from collection:", err);
  });
});

// Event listener for scheduling the notification job 30 minutes before class start
process.on("notificationBefore30minutes", async (payload) => {
  try {
    const startTime = moment(payload.startTime);
    const jobTime = startTime.subtract(30, 'minutes'); // Schedule 30 minutes before the start time

    await agenda.schedule(jobTime.toDate(), "notificationBefore30minutes", payload);
  } catch (error) {
    console.error("Error scheduling notificationBefore30minutes job:", error);
  }
});


agenda.define("notificationEndClassTime", async (job) => {
  let jobData = job.attrs.data;

  try {
    let bookingDetails = await Model.BookingDetails.findOne({
      _id: ObjectId(jobData._id)
    });

    let booking = await Model.Booking.findOne({
      _id: bookingDetails.bookingId
    });

    if (bookingDetails && booking) {
      const currentTime = moment();
      const endTime = moment(bookingDetails.endTime);
      const minutesUntilEnd = endTime.diff(currentTime, 'minutes');

      // Ensure we are at or after the class end time
      if (minutesUntilEnd <= 0) {
        if (bookingDetails.bookingStatus === constants.BOOKING_STATUS.ONGOING && bookingDetails.pairingType == constants.PAIRING_TYPE.START) {

          // Send notification to tutor
          process.emit("sendNotification", {
            tutorId: booking.tutorId,
            receiverId: booking.tutorId,
            bookingId: booking._id,
            values: booking,
            role: constants.ROLE.TUTOR,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.END_OF_CLASS
          });

          // Send notification to parent
          process.emit("sendNotification", {
            parentId: booking.parentId,
            receiverId: booking.parentId,
            bookingId: booking._id,
            values: booking,
            role: constants.ROLE.PARENT,
            isNotificationSave: true,
            pushType: constants.PUSH_TYPE_KEYS.END_OF_CLASS
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in sending notifications:", error);
  }

  // Remove the job after execution
  job.remove(function (err) {
    if (!err)
      console.log("Successfully removed job from collection");
    else
      console.error("Error removing job from collection:", err);
  });
});

// Event listener for scheduling the notification job at class end time
process.on("notificationEndClassTime", async (payload) => {
  try {
    const endTime = moment(payload.endTime);
    await agenda.schedule(endTime.toDate(), "notificationEndClassTime", payload); // Schedule the job at endTime
  } catch (error) {
    console.error("Error scheduling notificationEndClassTime job:", error);
  }
});

agenda.define("callJoin", async (job) => {
  let jobData = job.attrs.data;

  try {
    let bookingDetails = await Model.BookingDetails.findOne({
      _id: ObjectId(jobData._id)
    });

    let booking = await Model.Booking.findOne({
      _id: bookingDetails.bookingId
    });

    if (bookingDetails && booking) {
      const currentTime = moment();
      const startTime = moment(bookingDetails.startTime);
      const minutesUntilStart = startTime.diff(currentTime, 'minutes');

      // Ensure we are at the class start time
      if (minutesUntilStart <= 0 && bookingDetails.bookingStatus === constants.BOOKING_STATUS.ACCEPTED) {

        // Emit event for parent to join the call
        process.emit("joinCallParent", {
          parentId: booking.parentId,
          bookingDetails: bookingDetails
        });

        // Emit event for tutor to join the call
        process.emit("joinCallTutor", {
          tutorId: booking.tutorId,
          bookingDetails: bookingDetails
        });
      }
    }
  } catch (error) {
    console.error("Error in sending notifications:", error);
  }

  // Remove the job after execution
  job.remove(function (err) {
    if (!err)
      console.log("Successfully removed job from collection");
    else
      console.error("Error removing job from collection:", err);
  });
});

// Event listener for scheduling the socket join job at class start time
process.on("callJoin", async (payload) => {
  try {
    const startTime = moment(payload.startTime);
    await agenda.schedule(startTime.toDate(), "callJoin", payload); 
  } catch (error) {
    console.error("Error scheduling callJoin job:", error);
  }
});

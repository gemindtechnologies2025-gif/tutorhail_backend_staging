const Model = require("../../../models/index");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("../../../common/constants");
const services = require("../../../services/index");
const functions = require("../../../common/functions");
const bcrypt = require('bcrypt');
const moment = require('moment'); 

//send Email for booking function
const bookingEmail = async (totalNoOfHours, timeSlots, tutorEmail, tutorName, parentName, subject, timeZone) => {
  const firstTimeSlot = timeSlots[0];
  const userTimeZone = timeZone || 'UTC';

  const formattedTime = new Intl.DateTimeFormat('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true, 
    timeZone: userTimeZone 
  }).format(new Date(firstTimeSlot.startTime));

  const formattedDates = timeSlots.map(slot => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: userTimeZone 
    }).format(new Date(slot.date));
  });

  let payload = {
    title: "Booking Details",
    email: tutorEmail,
    name: tutorName,
    studentName: parentName,
    duration: totalNoOfHours,
    subjects: subject,
    dates: formattedDates.join(', '), 
    time: formattedTime 
  };

  await services.EmalService.bookingEmail(payload);
};

async function createBooking(body) {
let invoice = functions.generateInvoiceString();
body.body.invoiceNo = invoice;
let reqBody = body.body;
let booking, bookingDetails;
booking = await Model.Booking.create(reqBody);
let timeSlotsDetails = [];

for (const timeslot of reqBody.timeSlots) {
  bookingDetails = await Model.BookingDetails.create({
    bookingId: ObjectId(booking._id),
    startTime: timeslot.startTime,
    tutorId: timeslot.tutorId,
    endTime: timeslot.endTime,
    date: timeslot.date,
    noOfHours: timeslot.noOfHours,
    price: timeslot.perHourPrice,
    distance: reqBody.distance,
    transportationFees: reqBody.transportationFees,
    customTime: timeslot.customTime
  });

  timeSlotsDetails.push({
    date: timeslot.date,
    startTime: timeslot.startTime,
    endTime: timeslot.endTime
  });
}

 if(reqBody.promocodeId) {
    await Model.PromoCode.updateOne(
      { _id: reqBody.promocodeId },
      { $inc: { usedCount: 1 } }
    );
  }

await Model.User.findByIdAndUpdate(
    reqBody.tutorId,
    { $inc: { bookCount: 1 }}
);

const tutor = await Model.User.findById(reqBody.tutorId);
const tutorEmail = tutor.email;
const tutorName = tutor.name;
const timezone = tutor.timezone;

const parent = await Model.User.findById(reqBody.parentId);
const parentName = parent.name;

const subjects = await Model.Subjects.findById(reqBody.subjectId);
const subject = subjects.name;

bookingEmail(reqBody.totalNoOfHours, timeSlotsDetails, tutorEmail, tutorName, parentName, subject, timezone);
process.emit("sendNotification", {
  tutorId: booking.tutorId,
  receiverId: booking.tutorId,
  bookingId: booking._id,
  values: {
    bookingId: booking._id
  },
  role: constants.ROLE.TUTOR,
  isNotificationSave: true,
  pushType: constants.PUSH_TYPE_KEYS.BOOKING_ADDED
});

process.emit("notificationBefore30minutes", {
  _id: bookingDetails._id,
  startTime: bookingDetails.startTime
});

process.emit("notificationEndClassTime", {
  _id: bookingDetails._id,
  endTime: bookingDetails.endTime
});

process.emit("joinCall", {
  _id: bookingDetails._id,
  endTime: bookingDetails.startTime
});

return booking;
}

const classBookTutor = async (
  tutorEmail,
  tutorName,
  parentName,
  subject,
  duration,
  bookingNo,
  mode,
  date 
) => {
  const start = moment.utc(date);

  const formattedDate = start.format("dddd, MMMM D, YYYY"); 
  const formattedTime = start.format("HH:mm");

  let payload = {
    title: "New Class Booking",
    email: tutorEmail,
    tutorName: tutorName,
    parentName: parentName,
    subject: subject,
    duration: duration,
    mode: mode === true ? "Online" : "Offline",
    bookingNo: bookingNo,
    date: formattedDate,
    time: formattedTime
  };
  await services.EmalService.classBookTutor(payload);
};

const classBookParent = async (
  email,
  name,
  tutorName,
  subject,
  duration,
  bookingNo,
  mode,
  date
) => {
  const start = moment.utc(date);

  const formattedDate = start.format("dddd, MMMM D, YYYY"); 
  const formattedTime = start.format("HH:mm");

  const payload = {
    title: "Class Booking Confirmation",
    email: email,
    parentName: name,
    tutorName: tutorName,
    subject: subject,
    duration: duration,
    bookingNo: bookingNo,
    mode: mode === true ? "Online" : "Offline",
    date: formattedDate,
    time: formattedTime
  };
  services.EmalService.classBookParent(payload);
};

const sendParentLoginCredentials = async (parent, classDetails) => {
  try {
    const funcPassword = functions.generatePassword();
    const hashedPassword = await bcrypt.hash(funcPassword, 10);
    parent.password = hashedPassword;
    await parent.save();

    const payload = {
      email: parent.email.toLowerCase(),
      parentName: parent.name || parent.email,
      password: funcPassword,
      topic: classDetails.subject,
      tutorName: classDetails.tutorName,
      mode: classDetails.mode === true ? "Online" : "Offline",
      classDate: classDetails.date,   
      classTime: classDetails.time,   
      bookByname: classDetails.bookByname 
    };

    await services.EmalService.bookForOther(payload);
  } catch (error) {
    console.error("Error sending parent login credentials:", error);
  }
};

async function classBook(body) {
  let invoice = functions.generateInvoiceString();
  body.body.invoiceNo = invoice;
  let reqBody = body.body;
  reqBody.grandTotal = Number(reqBody.grandTotal) || 0;
  reqBody.serviceFees = Number(reqBody.serviceFees) || 0;
  reqBody.tutorMoney = Number(reqBody.tutorMoney) || 0;
  reqBody.bookingStatus = constants.BOOKING_STATUS.COMPLETED;
  const booking = await Model.Booking.create(reqBody);
  if (Array.isArray(reqBody.classSlotIds)) {
    await Promise.all(
      reqBody.classSlotIds.map(async (slotId) => {
        await Model.ClassSlots.updateOne(
          { _id: slotId, remainingSeats: { $gt: 0 } },
          { $inc: { remainingSeats: -1 } }
        );
      })
    );
  }

  // ✅ Increase class book count
  if (reqBody.classId) {
    await Model.Classes.updateOne(
      { _id: reqBody.classId },
      { $inc: { bookCount: 1 } }
    );
  }

  // ✅ Increase promo code usage
  if (reqBody.promocodeId) {
    await Model.PromoCode.updateOne(
      { _id: reqBody.promocodeId },
      { $inc: { usedCount: 1 } }
    );
  }

  // ✅ Update tutor earnings
  await Model.User.findByIdAndUpdate(
    reqBody.tutorId,
    {
      $inc: {
        classEarn: reqBody.tutorMoney,
        totalEarn: reqBody.tutorMoney,
        balance: reqBody.tutorMoney,
        bookCount: 1
      }
    }
  );

  // 📩 Emails + Notifications logic (unchanged)
  const tutor = await Model.User.findById(reqBody.tutorId);
  const tutorEmail = tutor.email;
  const tutorName = tutor.name;

  const parent = await Model.User.findById(reqBody.parentId);
  const parentName = parent.name;
  const parentEmail = parent.email;

  const subjects = await Model.Subjects.findById(reqBody.subjectId);
  const subject = subjects.name;

  const bookedBy = await Model.User.findById(reqBody.bookedBy);
  const bookByName = bookedBy.name;
  const bookByEmail = bookedBy.email;

  const classData = await Model.Classes.findById(reqBody.bookClassId);
  const duration = classData.duration;

  if (parent.isBookLogin) {
    const start = moment.utc(booking.startDate);
    const formattedDate = start.format("dddd, MMMM D, YYYY");
    const formattedTime = start.format("HH:mm");

    await sendParentLoginCredentials(parent, {
      subject: subject,
      tutorName: tutor.name,
      mode: booking.classModeOnline,
      date: formattedDate,
      time: formattedTime,
      bookByname: bookByName
    });

    classBookParent(
      bookByEmail,
      bookByName,
      tutorName,
      subject,
      duration,
      booking.bookingNumber,
      booking.classModeOnline,
      booking.startDate
    );
  } else {
    classBookParent(
      parentEmail,
      parentName,
      tutorName,
      subject,
      duration,
      booking.bookingNumber,
      booking.classModeOnline,
      booking.startDate
    );
  }

  classBookTutor(
    tutorEmail,
    tutorName,
    parentName,
    subject,
    duration,
    booking.bookingNumber,
    booking.classModeOnline,
    booking.startDate
  );

  // ✅ Notification
  process.emit("sendNotification", {
    tutorId: booking.tutorId,
    receiverId: booking.tutorId,
    bookingId: booking._id,
    values: {
      parentName: parentName,
      className: classData.topic
    },
    role: constants.ROLE.TUTOR,
    isNotificationSave: true,
    pushType: constants.PUSH_TYPE_KEYS.CLASS_BOOKED
  });

  return booking;
}


async function addGift(body) {
  const invoice = functions.generateInvoiceString();
  body.body.invoiceNo = invoice;
  const reqBody = body.body;

  reqBody.amount = reqBody.grandTotal;
  const gift = await Model.Gifts.create(reqBody);
  const content = await Model.Content.findById(reqBody.contentId);
  const tutorId = content.userId;

  await Model.Content.findByIdAndUpdate(
    gift.contentId,
    {
      $inc: {
        giftCount: 1,
        giftsEarn: gift.amount
      }
    });
  
   await Model.User.findByIdAndUpdate(
    tutorId,
    {
      $inc: {
        giftsEarn: gift.amount,
        totalEarn: gift.amount,
        balance: gift.amount
      }
    });

  const tutor = await Model.User.findById(tutorId);
  const tutorName = tutor?.name;
  const tutorEmail = tutor?.email;

  const parent = await Model.User.findById(reqBody.parentId);
  const parentName = parent?.name;

  process.emit("sendNotification", {
    tutorId: tutorId,
    receiverId: tutorId,
    giftId: gift._id,
    values: gift,
    role: constants.ROLE.TUTOR,
    isNotificationSave: true,
    pushType: constants.PUSH_TYPE_KEYS.GIFT_ADDED 
  });
  return gift;
}

module.exports = {
    createBooking,
    classBook,
    addGift
};
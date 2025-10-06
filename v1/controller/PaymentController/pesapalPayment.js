const axios = require('axios');
const Model = require("../../../models/index");
const common =  require('./common');
const constants = require("../../../common/constants");

async function generateToken() {
    try {
        let identity = process.env.CONSUMER_KEY;
        let password = process.env.CONSUMER_SECRET;

        let data = JSON.stringify({
            "consumer_key": identity,
            "consumer_secret": password
        });
          let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://pay.pesapal.com/v3/api/Auth/RequestToken',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cookie': '__cf_bm=4OCSXO9KSExkLAV7RS7z5BTV_xwX9EgCW2B5v1pVegk-1718256058-1.0.1.1-1JaE6Ia_dV0ustpyQryrupiOxyFaDz4.CnuCQxzsxH7LVEWgXuCkCmjmzJJemAw_NjOfLa2QllLfV6IytflDGA'
            },
            data : data
          };
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.log(error);
    }
}

async function generateIPN(token) {
  try {
    let data = JSON.stringify({
      "url": "http://www.myapplication.com/ipn",
      "ipn_notification_type": "GET"
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': token,
        'Cookie': '__cf_bm=NArTY5VykDEoAWVpPTA7QsCUQ0SPFN937ad1W3jXKVI-1718264162-1.0.1.1-ZMvPSDFr5q2xDo6WtJEFTwKCVO79mfqiDNdRuLzOOUsouBaztTey.lsDf4U.SKrKT2EwdXwLO3dSY4RCQiwtSA'
      },
      data : data
    };
      const response = await axios(config);
      return response.data;
  } catch (error) {
      console.log(error);
  }
}

async function generatePaymentLink(body, user) {
  try{
    let token = await generateToken();
    token = token.token;
    let ipn = await generateIPN(token);
    let callback_url = process.env.CALLBACK_URL;
    let dialCode = user.dialCode.replace('+', '');
    const grandTotal = body.body.grandTotal;

    let data = JSON.stringify({
      "id": body.cartId,
      "currency": "USD",
      "amount": grandTotal,
      "description": "Booking payment for class service",
      "callback_url": callback_url,
      "notification_id": ipn.ipn_id,
      "billing_address": {
        "email_address": user.email,
        "phone_number": user.phoneNo,
        "country_code": dialCode,
        "first_name": user.name,
        "last_name": user.name?.split(" ")[1] || "Doe",
        "line_1": "10th Floor, ABC Towers",
        "line_2": "Ngong Road",
        "city": "Nairobi",
        "state": "Nairobi County",
        "postal_code": "00100",
        "zip_code": "00100"
      }
    });


    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'Cookie': '__cf_bm=4OCSXO9KSExkLAV7RS7z5BTV_xwX9EgCW2B5v1pVegk-1718256058-1.0.1.1-1JaE6Ia_dV0ustpyQryrupiOxyFaDz4.CnuCQxzsxH7LVEWgXuCkCmjmzJJemAw_NjOfLa2QllLfV6IytflDGA'
      },
      data : data
    };

    const response = await axios(config);
    return response.data;
    } catch (error) {
        console.log(error, "error");
    }
}

//Payment
async function payment(req, res, next) {
  try {
    const cart = await Model.Cart.findOne({
      order_tracking_id: req.query.OrderTrackingId
    });
    if (!cart) {
      throw new Error("Cart not found for the provided OrderTrackingId.");
    }
    const detail = await getPaymentDetail(req.query.OrderTrackingId);
    if (detail.payment_status_description === "Completed") {
      cart.body.OrderTrackingId = req.query.OrderTrackingId;
      cart.body.confirmationCode = detail.confirmation_code;

      let booking, findBooking;
      if (cart.body.bookType === constants.BOOK_TYPE.CLASS) {
        if (cart.body.bookFor === constants.BOOK_FOR.OTHER) {
            let otherUser = await Model.User.findOne({
              email: cart.body.email
            });
        if (!otherUser) {
            otherUser = await Model.User.create({
            name: cart.body.name,
            email: cart.body.email,
            isBookLogin: true,
            role: constants.APP_ROLE.PARENT
          });
        }
        cart.body.parentId = otherUser._id;
      }
        booking = await common.classBook({ body: cart.body });
        findBooking = await Model.Booking.findOne({ _id: booking._id })
        .populate("parentId", "deviceDetails");
      } else if (cart.body.bookType === constants.BOOK_TYPE.NORMAL) {
        booking = await common.createBooking({ body: cart.body });
        findBooking = await Model.Booking.findOne({ _id: booking._id })
          .populate("parentId", "deviceDetails");
      } else if (cart.body.bookType === constants.BOOK_TYPE.GIFT) {
        booking = await common.addGift({ body: cart.body });
        findBooking = await Model.Gifts.findOne({ _id: booking._id })
        .populate("parentId", "deviceDetails");
      }

      process.emit("payment", {
        parentId: cart.parentId,
        paymentDetails: detail,
        bookFor: cart.body.bookFor,
        bookType: cart.body.bookType
      });

      if (findBooking?.parentId?.deviceDetails?.length) {
        const webDevices = findBooking.parentId.deviceDetails.filter(
          device => device.deviceType === "WEB"
        );
        webDevices.forEach(device => {
          if (detail.status_code === 1) {
            res.redirect(process.env.BOOKING_LINK);
          } else if (detail.status_code === 2) {
            res.redirect(process.env.LINK);
          }
        });
      }
      await Model.Cart.deleteMany({ parentId: cart.parentId });
    }
  } catch (error) {
    next(error);
  }
}

  async function getPaymentDetail(trackId) {
    try {
      let token = await generateToken();
      token = token.token;
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${trackId}`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': token,
          'Cookie': '__cf_bm=kAES_rhS6_baB4.JJ7MQR9vPRnm.pXr26LKMhwHKU2w-1718184208-1.0.1.1-7nWaNwyhLSJ146VJGCqyFQSyg0U185iLhMfWAzORZKsAgXcl8LCt0F6ThE9hgiDjwO3jD_MXCY4Qfm_vcC2vyg'
        }
      };
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.log(error);
    }
  }

  async function refundPayment(confirmationCode, payment, name) {
    try {
      let token = await generateToken();
      token = token.token;

      let data = JSON.stringify({
        "confirmation_code": confirmationCode,
        "amount": payment,
        "username": name,
        "remarks": "Payment refund"
      });
      let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://pay.pesapal.com/v3/api/Transactions/RefundRequest',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'Cookie': '__cf_bm=MGsM71E8kdFMKRdSZ6dcR2kHteya_giopWXojdYEUbw-1718338863-1.0.1.1-YqRt2fPzetZ_14TWq3jHmNTi9nqkwOzVCzwIUa_N18I6I8PyuqMRR8Uf_tHId3yrMH2f0wm2T_Xu63uo0fFs9g'
        },
        data : data
      };
        const response = await axios(config);
        return response.data;
    } catch (error) {
      console.log(error, "error");
    }
  }

module.exports = {
    generateToken,
    generateIPN,
    generatePaymentLink,
    payment,
    getPaymentDetail,
    refundPayment
};

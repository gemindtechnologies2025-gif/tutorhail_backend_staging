const nodemailer = require("nodemailer");
const constants = require("../common/constants");
const Model = require("../models/index");
const moment = require("moment");
const functions = require("../common/functions");

module.exports.send = async ({ to, title, message }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    try {
      const info = await transporter.sendMail({
        from: `"Tutor Hail" <${process.env.EMAIL_USER}>`,
        to: [].concat(to),
        subject: `${title}`,
        text: `${message}`,
        html: `${message}`,
      });
      console.log("EmailService", info);
    } catch (error) {
      console.log(error);
    }
  } catch (error) {
    console.error("EmailService", error);
  }
};
//Send email for verification code
exports.sendEmailVerificationParent = async (payload) => {
  try {
    if (!payload.email) throw new Error(constants.MESSAGES.EMAIL_MISSING);
    let otp = functions.generateNumber(4);
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Verify your account",
      message: `<!DOCTYPE html>
         <html>
         <head>            
             <link rel="preconnect" href="https://fonts.googleapis.com">
             <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
             <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
             <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
         </head>
         <body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
             <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
                 <tr>
                     <td style="padding: 0; background-color: #22252D;">
                         <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                             <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                         </figure>
                     </td>
                 </tr>
                 <tr>
                     <td style="padding: 20px 20px 40px;">
                         <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Hi, ${
                           payload.email
                         }</h4>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;">Thank you for signing up as Guardian/Learner for Tutorhail ! We're excited to have you on board. </p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">To complete the registration process and verify your email address, please use the OTP provided below:</p>
                         <h2 style="font-size: 24px; margin:10px 0 0;color: #65A442;">${otp}</h2>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Please enter this code on the signup page to activate your account.</p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you didn't request this OTP or have any questions, please let us know immediately.</p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd.</p>
                     </td>
                 </tr>
                 <tr>
                     <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
                     <ul style="padding-bottom: 10px; list-style: none;">
                             <li style="display: inline-block;  margin-right: 5px;">
                                 <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer;margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 5px;">  
                                     <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                         <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                     </figure>
                                 </a>
                             </li>
                         <li style="display: inline-block;">
                             <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         <li style="display: inline-block;">
                             <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         <li style="display: inline-block;">
                             <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         </ul>
                         <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright © ${moment().year()} .  All rights reserved </p>
                     </td>
                 </tr>
             </table>
         </body>
         </html>`,
    };
    await Model.Otp.deleteMany({
      email: payload.email.toLowerCase(),
    });

    let data = {
      email: payload.email.toLowerCase(),
      otp: otp,
      type: payload.type,
    };
    if (payload.parentId) {
      data.parentId = payload.parentId;
      await Model.Otp.create(data);
    }
    if (payload.tutorId) {
      data.tutorId = payload.tutorId;
      await Model.Otp.create(data);
    }
    await Model.Otp.create(data);
    await this.send(payloadData);
  } catch (error) {
    console.error("sendEmailVerification", error);
  }
};

exports.sendEmailVerificationTutor = async (payload) => {
  try {
    if (!payload.email) throw new Error(constants.MESSAGES.EMAIL_MISSING);
    let otp = functions.generateNumber(4);
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Verify your account",
      message: `<!DOCTYPE html>
         <html>
         <head>            
             <link rel="preconnect" href="https://fonts.googleapis.com">
             <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
             <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
             <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
         </head>
         <body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
             <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
                 <tr>
                     <td style="padding: 0; background-color: #22252D;">
                         <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                             <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                         </figure>
                     </td>
                 </tr>
                 <tr>
                     <td style="padding: 20px 20px 40px;">
                         <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Hi, ${
                           payload.email
                         }</h4>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;">Thank you for signing up as Tutor for Tutorhail ! We're excited to have you on board. </p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">To complete the registration process and verify your email address, please use the OTP provided below:</p>
                         <h2 style="font-size: 24px; margin:10px 0 0;color: #65A442;">${otp}</h2>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Please enter this code on the signup page to activate your account.</p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you didn't request this OTP or have any questions, please let us know immediately.</p>
                         <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd.</p>
                     </td>
                 </tr>
                 <tr>
                     <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
                     <ul style="padding-bottom: 10px; list-style: none;">
                             <li style="display: inline-block;  margin-right: 5px;">
                                 <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer;margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 5px;">  
                                     <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                         <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                     </figure>
                                 </a>
                             </li>
                         <li style="display: inline-block;">
                             <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         <li style="display: inline-block;">
                             <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         <li style="display: inline-block;">
                             <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                 <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                     <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                 </figure>
                             </a>
                         </li>
                         </ul>
                         <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright © ${moment().year()} .  All rights reserved </p>
                     </td>
                 </tr>
             </table>
         </body>
         </html>`,
    };
    await Model.Otp.deleteMany({
      email: payload.email.toLowerCase(),
    });

    let data = {
      email: payload.email.toLowerCase(),
      otp: otp,
      type: payload.type,
    };
    if (payload.parentId) {
      data.parentId = payload.parentId;
      await Model.Otp.create(data);
    }
    if (payload.tutorId) {
      data.tutorId = payload.tutorId;
      await Model.Otp.create(data);
    }
    await Model.Otp.create(data);
    await this.send(payloadData);
  } catch (error) {
    console.error("sendEmailVerification", error);
  }
};

exports.queryEmail = async (payload) => {
  try {
    if (!payload.email) {
      throw new Error(constants.MESSAGES.EMAIL_MISSING);
    }
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Revert for query or complaint",
      message: `
            <!DOCTYPE html>
            <html>
            <head>            
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            </head>
            <body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
                <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
                    <tr>
                        <td style="padding: 0; background-color: #22252D;">
                            <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                            </figure>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 20px 40px;">
                            <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Dear ${payload.name}</h4>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Thank you for reaching out to us regarding ${payload.query}. We appreciate your query and the opportunity to assist you. Please find below our responses to your query:</p>
                            <div style="border-left: 5px solid #65A442; background: #f9f9f9; padding: 15px 20px; margin: 10px 0 0; color: #313239; font-size: 16px; font-weight: 400;">
                                <p style="font-size: 16px; margin: 0 0 10px; font-weight: 400;">${payload.revertQuery}</p>
                               
                            </div>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you have any further questions or need additional clarification, please don't hesitate to let us know. We are here to help.</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Thank you for your patience and understanding</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                            <p style="margin: 0 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
                        <ul style="padding-bottom: 10px; list-style: none;">
                                <li style="display: inline-block;  margin-right: 5px;">
                                    <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer;margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 5px;">  
                                        <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                            <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                        </figure>
                                    </a>
                                </li>
                            <li style="display: inline-block;">
                                <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            <li style="display: inline-block;">
                                <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            <li style="display: inline-block;">
                                <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            </ul>
                            <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright © 2024 . All rights reserved</p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("queryEmail", error);
    throw error;
  }
};

exports.tutorAcceptEmail = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title,
      message: `
          <!DOCTYPE html>
          <html>
          <head>            
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
          </head>
          <body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
              <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
                  <tr>
                      <td style="padding: 0; background-color: #22252D;">
                          <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                              <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                          </figure>
                      </td>
                  </tr>
                  <tr>
                      <td style="padding: 20px 20px 40px;">
                          <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Hi, ${
                            payload.name
                          }</h4>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;">We are delighted to inform you that your tutor profile on  has been approved by our admin team!</p>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Your dedication and expertise have met our standards, and we believe you'll be a valuable addition to our community of tutors.</p>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Your profile is now live on our platform, and students can start discovering and booking sessions with you. Make sure to keep your profile updated with any changes or additional information to attract more students.</p>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Thank you for choosing to be a part of  We're excited to see you thrive and make a positive impact on your students' learning journey.</p>
                          <p  style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you have any questions or need assistance, feel free to reach out to our support team at <a href="#">support@tutorhail.com</a.</p>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                          <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd.</p>
                      </td>
                  </tr>
                  <tr>
                      <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
                      <ul style="padding-bottom: 10px; list-style: none;">
                              <li style="display: inline-block;  margin-right: 5px;">
                                  <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer;margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 5px;">  
                                      <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                          <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                      </figure>
                                  </a>
                              </li>
                          <li style="display: inline-block;">
                              <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                  <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                                      <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                  </figure>
                              </a>
                          </li>
                          <li style="display: inline-block;">
                              <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                  <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                      <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                  </figure>
                              </a>
                          </li>
                          <li style="display: inline-block;">
                              <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                  <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                      <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                  </figure>
                              </a>
                          </li>
                          </ul>
                          <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright ©${moment().year()}. All rights reserved</p>
                      </td>
                  </tr>
              </table>
          </body>
          </html>`,
    };
    this.send(payloadData);
  } catch (error) {
    console.error("tutorAccept", error);
    throw error;
  }
};

exports.tutorRejectEmail = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title,
      message: `
          <!DOCTYPE html>
  <html>
<head>            
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;box-sizing:border-box;font-family:'Urbanist',sans-serif;background-color:#f1f3f4;">
    <table style="border-bottom:4px solid #65A442;width:650px;margin:0 auto;background:#fff;border-spacing:0;">
        <tr>
            <td style="padding:0;background-color:#22252D;">
                <figure style="margin:auto;text-align:center;padding:15px;width:100px;height:auto;">
                    <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width:100%;height:auto;">
                </figure>
            </td>
        </tr>
        <tr>
            <td style="padding:20px 20px 40px;">
                <h4 style="color:#000;font-size:22px;font-weight:800;margin:0 0 15px;line-height:1.3;">Hi, ${payload.name}</h4>
                <p style="margin:15px 0 0;font-size:16px;color:#000;font-weight:500;line-height:1.5;">
                  We regret to inform you that your application to become a tutor has been unsuccessful. After careful review, our admin team has decided not to approve your tutor profile at this time.
                </p>
                ${
                  payload.reason
                    ? `<p style="margin:15px 0 0;font-size:16px;color:#000;font-weight:600;line-height:1.5;">Reason for rejection:</p>
                       <p style="margin:5px 0 15px;font-size:16px;color:#d9534f;font-weight:500;line-height:1.5;word-break:break-word;">
                         ${payload.reason}
                       </p>`
                    : ""
                }

                <p style="margin:15px 0 0;font-size:16px;color:#000;font-weight:500;line-height:1.5;">
                  While we appreciate your interest in joining our platform, we have specific criteria and standards that we must uphold to ensure the quality of education and experience for our students.
                </p>
                <p style="margin:15px 0 0;font-size:16px;color:#000;font-weight:500;line-height:1.5;">
                  We understand that this may be disappointing news, but please know that this decision does not reflect your abilities as a tutor.
                </p>
                <p style="margin:15px 0 0;font-size:16px;color:#000;font-weight:500;line-height:1.5;">
                  Best regards,<br/>TUTORHAIL International Ltd.
                </p>
            </td>
        </tr>
        <tr>
            <td style="text-align:center;padding:15px 25px;color:#fff;background:#1D1D1D;">
                <p style="margin:0 0 5px;font-size:13px;font-weight:500;">Copyright ©${moment().year()}. All rights reserved</p>
            </td>
        </tr>
    </table>
</body>
</html>`,
    };
    this.send(payloadData);
  } catch (error) {
    console.error("tutorReject", error);
    throw error;
  }
};


exports.bookingEmail = async (payload) => {
  try {
    if (!payload.email) {
      throw new Error("Email missing");
    }
    let payloadData = {
      to: payload.email,
      title: payload.title,
      message: `       
         <!DOCTYPE html>
        <html>
         <head>            
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
</head>
<body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
    <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
        <tr>
            <td style="padding: 0; background-color: #22252D;">
                <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                    <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                </figure>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 20px 40px;">
                <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Hi, ${
                  payload.name
                }</h4>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;">We're excited to inform you that a new booking request has been made for your tutoring services on Tutor Hail</p>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 700;line-height: 1.5;word-break: break-word;">Booking Details:</p>
                <p style="margin:15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Student Name: ${
                  payload.studentName
                }</p>
                <p style="margin:5px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Subject/Topic: ${
                  payload.subjects
                }</p>
                <p  style="margin:5px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Date: ${
                  payload.dates
                }</p>
                <p  style="margin:5px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Time: ${
                  payload.time
                }</p>
                <p style="margin:5px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Duration: ${
                  payload.duration
                } </p>
                <p  style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Please log in to your account on Tutor Hail to review and confirm the booking request. Once confirmed, you'll be all set to engage with the student at the scheduled time</p>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you have any questions or need assistance, feel free to reach out to our support team at <a href="#">support@tutorhail.com</a.</p>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Thank you for being a valued member of our tutoring community. We appreciate your commitment to helping students succeed.</p>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd.</p>
            </td>
        </tr>
        <tr>
            <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
            <ul style="padding-bottom: 10px; list-style: none;">
                <li style="display: inline-block; margin-right: 5px;">
                 <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer; margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px; height: 35px; border-radius: 35px; background: #65A442; padding: 5px;">  
                <figure style="margin: 0; width: 30px; height: 30px; padding: 5px;">
                 <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                 </figure>
                </a>
            </li>
                <li style="display: inline-block;">
                    <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                        <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                            <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                        </figure>
                    </a>
                </li>
                <li style="display: inline-block;">
                    <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                        <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                            <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                        </figure>
                    </a>
                </li>
                <li style="display: inline-block;">
                    <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                        <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                            <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                        </figure>
                    </a>
                </li>
                </ul>
                <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright ©${moment().year()}. All rights reserved</p>
            </td>
        </tr>
    </table>
</body>
</html>`,
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("bookingEmail", error);
    throw error;
  }
};

exports.forgotPasswordEmail = async (payload) => {
  try {
    if (!payload.email) throw new Error(constants.MESSAGES.EMAIL_MISSING);
    let otp = functions.generateNumber(4);
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Forgot Password",
      message: `
            <!DOCTYPE html>
            <html>
            <head>            
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
            </head>
            <body style=" margin: 0;padding: 0;box-sizing: border-box;font-family: 'Urbanist', sans-serif;background-color: #f1f3f4;">
                <table style="border-bottom:4px solid #65A442;width: 650px; margin:0px auto; background:#fff; border-spacing: 0;" >
                    <tr>
                        <td style="padding: 0; background-color: #22252D;">
                            <figure style="margin: auto;  text-align: center; padding: 15px;width: 100px;height: auto;">
                                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;;">
                            </figure>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 20px 40px;">
                            <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3; word-break: break-word;">Forgot Password</h4>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">We've received a request to reset the password for your account. To proceed, please use the following One-Time Password</p>
                            <a href="#" style="background-color: #65A442;color:#fff; text-decoration: none; border-radius: 8px; padding: 12px 24px; margin: 15px 0;display: inline-block;">${otp}</a>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Please enter this OTP on the password reset page to create a new password and regain access to your account.
                                If you didn't initiate this password reset request, please ignore this email. Your account security is important to us.</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">If you need further assistance or have any questions, feel free to reach out to our support team at  <a href="#">support@tutorhail.com</a></p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">Best regards,</p>
                            <p style="margin: 15px 0 0;font-size: 16px;color: #000000;font-weight: 500;line-height: 1.5;word-break: break-word;">TUTORHAIL International Ltd.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align: center; padding: 15px 25px ; color: #fff; background: #1D1D1D;">
                        <ul style="padding-bottom: 10px; list-style: none;">
                                <li style="display: inline-block;  margin-right: 5px;">
                                    <a href="https://www.instagram.com/tutorhail?igshid=MWExZno1YjBjdGdvag==" style="cursor: pointer;margin-right: 7px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 5px;">  
                                        <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                            <img src="https://trtl1.s3.amazonaws.com/1715314632634instagram.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                        </figure>
                                    </a>
                                </li>
                            <li style="display: inline-block;">
                                <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 10px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314446074facebook.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            <li style="display: inline-block;">
                                <a href = "https://www.linkedin.com/company/tutorhail/https://www.linkedin.com/company/tutorhail/" style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314717524linkdin.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            <li style="display: inline-block;">
                                <a style="cursor: pointer;margin-right: 5px; display: inline-flex; justify-content: center; align-items: center; width: 35px;height: 35px; border-radius: 35px;background: #65A442; padding: 7px;">  
                                    <figure style="margin: 0;width: 30px;height: 30px; padding: 5px;">
                                        <img src="https://trtl1.s3.amazonaws.com/1715314675484youtube.png" style="width: 100%; height: 100%; object-fit: contain; filter: brightness(0) invert(1);">
                                    </figure>
                                </a>
                            </li>
                            </ul>
                            <p style="margin: 0 0 5px; font-size: 13px; font-weight: 500;">Copyright © ${moment().year()} . All rights reserved</p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
    };
    await Model.Otp.deleteMany({
      email: payload.email.toLowerCase(),
    });

    let data = {
      email: payload.email.toLowerCase(),
      otp: otp,
      type: payload.type,
    };
    if (payload.parentId) data.parentId = payload.parentId;
    await Model.Otp.create(data);

    if (payload.tutorId) data.tutorId = payload.tutorId;
    await Model.Otp.create(data);

    await this.send(payloadData);
  } catch (error) {
    console.error("forgotPasswordEmail", error);
  }
};

exports.classBookTutor = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Class Booking",
      message: `<!DOCTYPE html>
<html>
   <head>
      <meta charset="UTF-8" />
      <title>New Class Scheduled</title>
   </head>
   <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
      <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
         background-size: cover;
         background-position: center;
         max-width: 600px;
         margin: 50px auto;
         border-radius: 8px;
         box-shadow: 0 10px 30px rgba(0,0,0,0.2);
         width: 100%;
         border-collapse: collapse;">
         <tr>
            <td style="padding: 30px;">
               <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">
                  <!-- Logo Row -->
                  <tr>
                     <td style="text-align: center; padding: 10px 0 20px;">
                        <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
                     </td>
                  </tr>
                  <!-- Tutor Message -->
                  <tr>
                     <td style="font-size: 15px; color: #444; line-height: 1.6;">
                        <p>Hi <strong>${payload.tutorName}</strong>,</p>
                        <p>Great news! A new class has been scheduled.</p>
                        <ul style="list-style-type: none; padding-left: 0;">
                           <li> <strong>Name:</strong> ${payload.parentName}</li>
                           <li> <strong>Class Date & Time:</strong> ${payload.date}, ${payload.time}</li>
                           <li> <strong>Class Duration:</strong> ${payload.duration} Minutes</li>
                           <li> <strong>Subject:</strong> ${payload.subject}</li>
                           <li> <strong>Mode:</strong> ${payload.mode}</li>
                           <li> <strong>Booking ID:</strong> ${payload.bookingNo}</li>
                        </ul>
                        <p>Please make sure to be available at the scheduled time. You can view all your upcoming classes in your Tutor Dashboard.</p>
                        <p>If you have any questions, feel free to contact support.</p>
                        <p>Thanks,<br><strong>Team Tutor Hail</strong></p>
                     </td>
                  </tr>
               </table>
            </td>
         </tr>
      </table>
   </body>
</html>`
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Class Book", error);
  }
};

exports.classBookParent = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Class Booking",
      message: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Class Booking Confirmation</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">

            <!-- Logo Row -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>

            <!-- NEW MESSAGE CONTENT -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Hi <strong>${payload.parentName}</strong>,</p>
                <p>Your class with <strong>${payload.tutorName}</strong> has been successfully booked!</p>

                <ul style="list-style-type: none; padding-left: 0;">
                  <li> <strong>Class Date & Time:</strong> ${payload.date}, ${payload.time}</li>
                  <li> <strong>Class Duration:</strong> ${payload.duration} Minutes</li>
                  <li> <strong>Subject:</strong> ${payload.subject}</li>
                  <li> <strong>Mode:</strong> ${payload.mode}</li>
                  <li> <strong>Booking ID:</strong> ${payload.bookingNo}</li>
                </ul>

                <p>You can manage the class through your Parent Dashboard.</p>
                <p>Thank you for choosing <strong>Tutor Hail</strong>!</p>
                <p>Best regards,<br><strong>Team Tutor Hail</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Class Book", error);
  }
};

exports.bookForOther = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Class Booking",
      message: `
            <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Student Credentials</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">

            <!-- Logo Row -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>

            <!-- Message Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #65A442; font-size: 22px;">Student Login Credentials</h2>
              </td>
            </tr>

            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Dear <strong>${payload.parentName}</strong>,</p>

                <p>Your class <strong>${payload.topic}</strong> has been successfully booked for you by <strong>${payload.bookByname}</strong>.</p>

                <p><strong>Here are your login credentials:</strong><br>
                  Email: <strong>${payload.email}</strong><br>
                  Password: <strong>${payload.password}</strong>
                </p>

                <p><strong>Class Details:</strong><br>
                  • Date: ${payload.classDate}<br>
                  • Time: ${payload.classTime}<br>
                  • Tutor: ${payload.tutorName}<br>
                  • Mode: ${payload.mode}
                </p>

                <p>Please log in to your account before the session and be ready on time.</p>

                <p>If you have any questions or need help, feel free to contact us.</p>

                <p>Best regards,<br><strong>Team Tutor Hail</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`,
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Inquiry", error);
  }
};

exports.tutorReport = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Revert on Tutor Report",
      message: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Issue Report Acknowledgment</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">
            
            <!-- Logo Row -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>
            
            <!-- Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #65A442; font-size: 22px;">Report Received</h2>
                <p style="color: #444; margin: 5px 0 0;">We’ve received your concern and are looking into it</p>
              </td>
            </tr>

            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Dear <strong>${payload.parentName}</strong>,</p>

                <p>Thank you for reporting the issue with <strong>${payload.tutorName}</strong>.</p>

                <p>Here’s a summary of your report:</p>

                <blockquote style="border-left: 3px solid #65A442; margin: 10px 0; padding-left: 15px; color: #333; font-style: italic;">
                  ${payload.reason}
                </blockquote>

                <p>We’ve received your concern and are currently <strong>${payload.revert}</strong>.</p>

                <p>We appreciate your feedback and will handle this as per our policies.</p>

                <p>Best regards,<br>Team Tutor Hail</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Class Book", error);
  }
};

exports.contentReport = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Content Report Revert",
      message: `
           <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Content Report Acknowledged</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">

            <!-- Logo -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #D9534F; font-size: 22px;">Content Report Acknowledgment</h2>
                <p style="color: #444; margin: 5px 0 0;">Thank you for helping us keep the platform safe</p>
              </td>
            </tr>

            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Dear <strong>${payload.parentName}</strong>,</p>

                <p>Thank you for reporting the content shared by <strong>${payload.tutorName}</strong>.</p>

                <p><strong>Here’s a summary of your report:</strong></p>
                <blockquote style="border-left: 3px solid #D9534F; margin: 10px 0; padding-left: 15px; color: #333; font-style: italic;">
                  ${payload.report}
                </blockquote>
                <p> ${payload.reason}</p>

                <p>We’ve reviewed the content and have <strong>${payload.revert}</strong> in line with our platform policies.</p>

                <p>We appreciate your effort in helping us maintain a safe and respectful environment.</p>

                <p>Best regards,<br>Team Tutor Hail</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`,
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Inquiry", error);
  }
};

exports.inquiry = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Inquiry",
      message: `
           <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>New Inquiry Received</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">

            <!-- Logo Row -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #65A442; font-size: 22px;">New Inquiry</h2>
                <p style="color: #444; margin: 5px 0 0;">You’ve received a new inquiry from a parent</p>
              </td>
            </tr>

            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Dear <strong>${payload.tutorName}</strong>,</p>

                <p>You’ve received a new inquiry from a parent. Below are the details:</p>

                <p>
                  <strong>Parent Name:</strong> ${payload.parentName}<br>
                  <strong>Contact Email:</strong> ${payload.parentEmail}
                </p>

                <p><strong>Message:</strong></p>
                <blockquote style="border-left: 3px solid #65A442; margin: 10px 0; padding-left: 15px; color: #333; font-style: italic;">
                 ${payload.type}
                </blockquote>
                <p> ${payload.other}</p>
                <p>Please review and respond at your earliest convenience.</p>

                <p>Best regards,<br>Team Tutor Hail</strong></p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Inquiry", error);
  }
};

exports.inquiryGuest = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Inquiry",
      message: `
          <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Response to Your Inquiry</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">

            <!-- Logo -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #4285f4; font-size: 22px;">Response to Your Inquiry</h2>
                <p style="color: #444; margin: 5px 0 0;">Thank you for reaching out to us</p>
              </td>
            </tr>

            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Dear <strong>${payload.parentName}</strong>,</p>

                <p>We hope you're doing well.</p>

                <p>Here are the details regarding your inquiry:</p>

                <p><strong>Tutor Name:</strong> ${payload.tutorName}</p>
                <p><strong>Inquiry Type:</strong> ${payload.type}</p>
                <p>${payload.other}</p>

                <p><strong>Response:</strong></p>
                <blockquote style="border-left: 3px solid #4285f4; margin: 10px 0; padding-left: 15px; color: #333;">
                  ${payload.revert}
                </blockquote>

                <p>If you have any further questions or concerns, feel free to reach out. We're here to help!</p>

                <p>Best regards,<br>
                  <strong>Team Tutor Hail</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
};
    await this.send(payloadData);
  } catch (error) {
    console.error("Inquiry", error);
  }
};

exports.classReport = async (payload) => {
  try {
    let payloadData = {
      to: payload.email,
      title: payload.title ? payload.title : "Revert on Class Report",
      message: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Response to Your Report</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #f5f5f5;">
    <table style="background-image: url('https://enilcon.s3.ap-south-1.amazonaws.com/725745_union.jpg'); background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
        max-width: 600px;
        margin: 50px auto;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        width: 100%;
        border-collapse: collapse;">
      <tr>
        <td style="padding: 30px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.94); border-radius: 10px; padding: 20px;">
            <!-- Logo -->
            <tr>
              <td style="text-align: center; padding: 10px 0 20px;">
                <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" alt="Logo" style="max-height: 50px;">
              </td>
            </tr>
            <!-- Title -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <h2 style="margin: 0; color: #4285f4; font-size: 22px;">Response to Your Report</h2>
              </td>
            </tr>
            <!-- Message Content -->
            <tr>
              <td style="font-size: 15px; color: #444; line-height: 1.6;">
                <p>Hello <strong>${payload.parentName}</strong>,</p>
                <p>Thank you for bringing this to our attention. We’ve received your report regarding the class <strong>${payload.classTopic}</strong>.</p>

                <p><strong>Reason you reported:</strong><br>
                  ${payload.report}<br>
                  ${payload.reason}
                </p>

                <p><strong>Our Response:</strong><br>
                  ${payload.revert}
                </p>

                <p>We truly appreciate your effort in helping us maintain a safe and positive learning environment.</p>

                <p>If you have any additional details to share, please reply to this email.</p>

                <p>Best regards,<br>
                  <strong>Team Tutorhail</strong>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding-top: 30px; font-size: 13px; color: #888; text-align: center;">
                <p style="margin: 0;">&copy; Tutorhail</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
    };
    await this.send(payloadData);
  } catch (error) {
    console.error("Class Book", error);
  }
};
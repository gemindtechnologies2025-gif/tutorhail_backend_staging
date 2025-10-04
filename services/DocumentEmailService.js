const EmailService = require('./EmalService');

// Document Approval Email
exports.documentApproved = async (payload) => {
  try {
    if (!payload.email) {
      throw new Error("Email missing");
    }
    
    let payloadData = {
      to: payload.email,
      title: "Document Approved - Tutor Hail",
      message: `
<!DOCTYPE html>
<html>
<head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; box-sizing: border-box; font-family: 'Urbanist', sans-serif; background-color: #f1f3f4;">
    <table style="border-bottom: 4px solid #65A442; width: 650px; margin: 0px auto; background: #fff; border-spacing: 0;">
        <tr>
            <td style="padding: 0; background-color: #22252D;">
                <figure style="margin: auto; text-align: center; padding: 15px; width: 100px; height: auto;">
                    <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;">
                </figure>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 20px 40px;">
                <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3;">Hi, ${payload.tutorName}</h4>
                
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h3 style="color: #155724; margin: 0 0 10px; font-size: 18px;">🎉 Great News! Your Document Has Been Approved</h3>
                    <p style="color: #155724; margin: 0; font-size: 14px;">Your document verification is complete and has been approved by our admin team.</p>
                </div>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    We're pleased to inform you that your document has been successfully verified and approved. This brings you one step closer to completing your tutor profile.
                </p>

                <div style="background-color: #f8f9fa; border-left: 4px solid #65A442; padding: 15px; margin: 20px 0;">
                    <h5 style="color: #000000; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Document Details:</h5>
                    <p style="margin: 5px 0; font-size: 14px; color: #555;">
                        <strong>Document Type:</strong> ${payload.documentType}<br>
                        <strong>Description:</strong> ${payload.description}<br>
                        <strong>Approved On:</strong> ${payload.approvedDate}
                    </p>
                </div>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    Your profile is now one step closer to being complete. Keep up the great work!
                </p>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    If you have any questions or need assistance, please don't hesitate to contact our support team.
                </p>

                <p style="margin: 20px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    Best regards,<br>
                    <strong>Team Tutor Hail</strong>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
`,
    };
    await EmailService.send(payloadData);
  } catch (error) {
    console.error("documentApproved", error);
  }
};

// Document Rejection Email
exports.documentRejected = async (payload) => {
  try {
    if (!payload.email) {
      throw new Error("Email missing");
    }
    
    let payloadData = {
      to: payload.email,
      title: "Document Rejection - Action Required - Tutor Hail",
      message: `
<!DOCTYPE html>
<html>
<head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; box-sizing: border-box; font-family: 'Urbanist', sans-serif; background-color: #f1f3f4;">
    <table style="border-bottom: 4px solid #dc3545; width: 650px; margin: 0px auto; background: #fff; border-spacing: 0;">
        <tr>
            <td style="padding: 0; background-color: #22252D;">
                <figure style="margin: auto; text-align: center; padding: 15px; width: 100px; height: auto;">
                    <img src="https://trtl1.s3.amazonaws.com/1714019523907logoo.png" style="width: 100%; height: auto;">
                </figure>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 20px 40px;">
                <h4 style="color: #000000; font-size: 22px; font-weight: 800; margin: 0 0 15px; line-height: 1.3;">Hi, ${payload.tutorName}</h4>
                
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h3 style="color: #721c24; margin: 0 0 10px; font-size: 18px;">📋 Document Rejection - Re-upload Required</h3>
                    <p style="color: #721c24; margin: 0; font-size: 14px;">Unfortunately, your document could not be approved at this time.</p>
                </div>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    We regret to inform you that your submitted document has been rejected by our verification team. Please review the reason below and resubmit your document.
                </p>

                <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                    <h5 style="color: #000000; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Document Details:</h5>
                    <p style="margin: 5px 0; font-size: 14px; color: #555;">
                        <strong>Document Type:</strong> ${payload.documentType}<br>
                        <strong>Description:</strong> ${payload.description}<br>
                        <strong>Rejected On:</strong> ${payload.rejectedDate}
                    </p>
                </div>

                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h5 style="color: #856404; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Reason for Rejection:</h5>
                    <p style="color: #856404; margin: 0; font-size: 14px; font-style: italic;">
                        "${payload.rejectionReason || 'Document quality does not meet our verification standards.'}"
                    </p>
                </div>

                <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h5 style="color: #0c5460; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Next Steps:</h5>
                    <ul style="color: #0c5460; margin: 0; padding-left: 20px; font-size: 14px;">
                        <li>Please review the rejection reason above</li>
                        <li>Prepare a new document that meets our requirements</li>
                        <li>Log in to your tutor account and re-upload the document</li>
                        <li>Ensure the document is clear, readable, and complete</li>
                    </ul>
                </div>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    Don't worry - this is a normal part of the verification process. Many tutors need to resubmit documents to ensure quality and compliance.
                </p>

                <p style="margin: 15px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    If you have any questions about the rejection reason or need assistance with document requirements, please contact our support team.
                </p>

                <p style="margin: 20px 0 0; font-size: 16px; color: #000000; font-weight: 500; line-height: 1.5;">
                    Best regards,<br>
                    <strong>Team Tutor Hail</strong>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
`,
    };
    await EmailService.send(payloadData);
  } catch (error) {
    console.error("documentRejected", error);
  }
};

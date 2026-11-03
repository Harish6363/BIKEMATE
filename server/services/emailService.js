const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Returns a pooled singleton Nodemailer transporter
 */
function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }
  if (!transporter) {
    const cleanPassword = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true, // Maintain pooled connections for rapid reuse and no TLS renegotiation lag
      maxConnections: 3,
      maxMessages: 100,
      socketTimeout: 30000,
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
}

/**
 * Sends a 6-digit verification OTP email to a student or faculty BITM email address.
 * 
 * Configured with:
 * - RFC 5322 ASCII-clean sender display name (no emojis in From header to prevent Microsoft 365 EOP spam flags)
 * - Both text/plain and text/html multipart alternative (required by antispam engines)
 * - OTP code inside the subject line for instant notification visibility
 * - High priority headers for fast inbox delivery
 */
async function sendVerificationOtpEmail({ email, otp, name }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('⚠️ [EMAIL SERVICE] Gmail SMTP credentials (GMAIL_USER / GMAIL_APP_PASSWORD) are not configured.');
    return { 
      success: false, 
      error: 'Gmail SMTP credentials are not configured on the server.' 
    };
  }

  const cleanEmail = email.toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
  const greeting = name ? `Hello ${name},` : 'Hello,';

  const plainText = `${greeting}

Your BikeMate Verification OTP is: ${otp}

This OTP is valid for 5 minutes only.
Please enter this code in the registration screen to verify your official college email.

Important for BITM Outlook / Office 365 users:
If this email appeared in your "Other" tab or "Junk / Spam" folder, please move it to your "Focused" inbox.

Do not share this OTP with anyone.

— The BikeMate Team
Ballari Institute of Technology and Management (BITM)`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your BikeMate Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #00b87c; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">BikeMate</h1>
              <p style="margin: 4px 0 0 0; color: #e6f9f2; font-size: 13px; font-weight: 500;">BITM Campus Carpool &amp; Ride Sharing</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #1e293b;">${greeting}</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #475569;">
                Use the verification code below to verify your college email and activate your BikeMate account:
              </p>

              <!-- OTP Display Box -->
              <div style="background-color: #f0fdf4; border: 2px dashed #00b87c; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 6-Digit OTP</span>
                <span style="display: block; font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f172a;">${otp}</span>
                <span style="display: block; font-size: 12px; font-weight: 600; color: #b45309; margin-top: 10px;">⏰ Valid for 5 minutes only</span>
              </div>

              <!-- Outlook Guidance Notice -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #1e40af;">
                  <strong>Note for BITM Outlook users:</strong> If you don't see future ride notifications in your primary inbox, please check your <em>"Other"</em> tab or <em>"Junk Email"</em> folder.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Never share this code with anyone. If you didn't request this OTP, you can safely disregard this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Ballari Institute of Technology and Management (BITM)<br>
                Official Student &amp; Faculty Campus Carpool System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const info = await mailer.sendMail({
      from: `"BikeMate BITM" <${process.env.GMAIL_USER.trim()}>`,
      to: cleanEmail,
      subject: `BikeMate Verification OTP: ${otp} (Valid for 5 mins)`,
      text: plainText,
      html: html,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    });

    console.log(`✅ [EMAIL DISPATCHED] OTP sent to: ${cleanEmail} | Message ID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    };
  } catch (err) {
    console.error(`❌ [EMAIL DISPATCH FAILED] Error sending to ${cleanEmail}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Sends a password reset OTP email
 */
async function sendPasswordResetOtpEmail({ email, otp, name }) {
  const mailer = getTransporter();
  if (!mailer) {
    return { success: false, error: 'Gmail SMTP credentials not configured.' };
  }

  const cleanEmail = email.toLowerCase().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
  const greeting = name ? `Hello ${name},` : 'Hello,';

  const plainText = `${greeting}

Your BikeMate Password Reset OTP is: ${otp}

This OTP is valid for 10 minutes only.
Please enter this code in the password reset screen.

Do not share this OTP with anyone.

— The BikeMate Team
Ballari Institute of Technology and Management (BITM)`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: sans-serif; color: #1e293b;">
  <div style="max-width: 480px; margin: 30px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #00b87c; padding: 20px; text-align: center; color: white;">
      <h2 style="margin:0;">BikeMate Password Reset</h2>
    </div>
    <div style="padding: 24px;">
      <p>${greeting}</p>
      <p>We received a request to reset the password for your BikeMate account.</p>
      <div style="background-color: #f0fdf4; border: 2px dashed #00b87c; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${otp}</span>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #b45309;">Valid for 10 minutes</p>
      </div>
      <p style="font-size: 12px; color: #64748b;">If you did not request a password reset, please secure your account immediately.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const info = await mailer.sendMail({
      from: `"BikeMate BITM" <${process.env.GMAIL_USER.trim()}>`,
      to: cleanEmail,
      subject: `BikeMate Password Reset Code: ${otp}`,
      text: plainText,
      html: html,
      priority: 'high'
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getTransporter,
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail
};

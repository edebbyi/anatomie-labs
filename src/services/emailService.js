const logger = require('../utils/logger');

/**
 * Send account deletion scheduled confirmation email (best-effort, no-op if not configured)
 * @param {string} toEmail
 * @param {string} [userName]
 */
async function sendAccountDeletionScheduled(toEmail, userName = 'there') {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
      logger.warn('Email service not configured. Skipping deletion confirmation email.');
      return;
    }

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      logger.warn('nodemailer is not installed. Skipping deletion confirmation email.');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: (Number(SMTP_PORT) || 587) === 465, // true for 465, false for others
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const subject = 'Your account has been scheduled for deletion';
    const html = `
      <p>Hi ${userName},</p>
      <p>We have received a request to delete your account.</p>
      <p>Your account has been deactivated and is scheduled for permanent deletion in 30 days. If this was a mistake, please contact support immediately.</p>
      <p>Regards,<br/>Support Team</p>
    `;

    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject,
      text: `Hi ${userName},\n\nYour account has been deactivated and is scheduled for permanent deletion in 30 days. If this was a mistake, please contact support immediately.\n\nRegards,\nSupport Team`,
      html,
    });

    logger.info('Deletion confirmation email sent', { to: toEmail, messageId: info.messageId });
  } catch (error) {
    logger.error('Failed to send deletion confirmation email', { error: error.message });
  }
}

module.exports = {
  sendAccountDeletionScheduled,
};

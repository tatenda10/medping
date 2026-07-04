const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

// Fallbacks: cPanel-style SMTP is often `mail.<domain>`
// You can override via SMTP_HOST in server/.env
const host = SMTP_HOST || 'mail.mediping.website';
const port = SMTP_PORT ? Number(SMTP_PORT) : 465;
const secure = SMTP_SECURE ? SMTP_SECURE === 'true' : true;

if (!SMTP_USER || !SMTP_PASS) {
  console.warn(
    '⚠️ SMTP_USER / SMTP_PASS not set. Password reset emails will fail until these are configured in server/.env.'
  );
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    // Helps with some hosts/certs when the SMTP host differs from the auth domain
    servername: host,
  },
});

async function sendMail(options) {
  const from =
    SMTP_FROM || `MediPing Support <${SMTP_USER || 'support@mediping.website'}>`;

  const mailOptions = {
    from,
    ...options,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendMail,
};


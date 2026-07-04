const infobip = require('../config/infobip');

/**
 * Normalize phone to international digits only (E.164 without +).
 * Strips spaces, dashes, and leading +.
 */
function normalizePhoneNumber(phone) {
  if (phone == null || phone === '') return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/**
 * Send SMS if Infobip is configured. Returns null when SMS is skipped (not configured).
 */
async function sendSms(to, text) {
  if (!infobip.isConfigured()) {
    console.warn('⚠️ Infobip SMS not configured — skipping send');
    return { skipped: true, reason: 'not_configured' };
  }

  const destination = normalizePhoneNumber(to);
  if (!destination) {
    throw new Error('Invalid phone number for SMS');
  }

  const result = await infobip.sendSms(destination, text);
  console.log(`📱 Infobip SMS sent to ${destination}`);
  return result;
}

function isConfigured() {
  return infobip.isConfigured();
}

module.exports = {
  sendSms,
  normalizePhoneNumber,
  isConfigured,
};

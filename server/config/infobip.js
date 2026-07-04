const config = require('./env');

/**
 * Send an SMS via Infobip.
 * @see https://www.infobip.com/docs/sms/send-message
 * @see https://www.infobip.com/docs/api/channels/sms/send-sms-message
 */
async function sendSms(to, text) {
  const apiKey = config.INFOBIP_API_KEY;
  const baseUrl = (config.INFOBIP_BASE_URL || 'https://api.infobip.com').replace(/\/$/, '');
  const from = config.INFOBIP_SMS_FROM;

  if (!apiKey) {
    throw new Error('INFOBIP_API_KEY is not set');
  }
  if (!from) {
    throw new Error('INFOBIP_SMS_FROM is not set');
  }
  if (!to || !text) {
    throw new Error('SMS requires both "to" and "text"');
  }

  const destination = String(to).replace(/\D/g, '');
  if (!destination) {
    throw new Error('Invalid destination phone number');
  }

  const url = `${baseUrl}/sms/2/text/advanced`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          destinations: [{ to: destination }],
          from,
          text,
        },
      ],
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      data?.requestError?.serviceException?.text ||
      data?.requestError?.serviceException?.messageId ||
      data?.message ||
      response.statusText;
    console.error('Infobip SMS error:', response.status, data);
    throw new Error(detail || `Infobip SMS failed (${response.status})`);
  }

  return data;
}

function isConfigured() {
  return !!(config.INFOBIP_API_KEY && config.INFOBIP_SMS_FROM);
}

module.exports = {
  sendSms,
  isConfigured,
};

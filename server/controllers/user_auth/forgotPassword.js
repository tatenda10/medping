const crypto = require('crypto');
const mysql = require('../../config/mysql');
const { sendMail } = require('../../config/email');

async function ensurePasswordResetsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_resets (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_resets_user_id (user_id),
      INDEX idx_password_resets_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await mysql.query(sql);
}

function generateCode() {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user by email
    const users = await mysql.query(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    // Always respond success to avoid leaking which emails exist
    if (!users || users.length === 0) {
      return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
    }

    const user = users[0];
    if (!user?.id) {
      // Defensive: unexpected row shape
      return res.json({ success: true, message: 'If that email exists, a reset code has been sent.' });
    }

    await ensurePasswordResetsTable();

    const code = generateCode();
    const id = crypto.randomUUID();

    // 15 minutes expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await mysql.query(
      'INSERT INTO password_resets (id, user_id, code, expires_at, used) VALUES (?, ?, ?, ?, 0)',
      [id, user.id, code, expiresAt]
    );

    // Send password reset email
    try {
      await sendMail({
        to: normalizedEmail,
        subject: 'MediPing password reset code',
        text: `Your MediPing password reset code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `
          <p>Hi,</p>
          <p>Your <strong>MediPing</strong> password reset code is:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
          <p>This code will expire in <strong>15 minutes</strong>.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        `,
      });
      console.log(`📧 Password reset email sent to ${normalizedEmail}`);
    } catch (emailErr) {
      console.error('Failed to send password reset email:', emailErr);
      // Still respond success so we don’t leak details to clients
    }

    return res.json({
      success: true,
      message: 'If that email exists, a reset code has been sent.',
    });
  } catch (err) {
    console.error('Error in forgotPassword:', err);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
};


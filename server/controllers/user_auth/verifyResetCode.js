const mysql = require('../../config/mysql');

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

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedCode = String(code).trim();

    const users = await mysql.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (!users || users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    const user = users[0];

    await ensurePasswordResetsTable();

    const rows = await mysql.query(
      `SELECT id
       FROM password_resets
       WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, trimmedCode]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    return res.json({ success: true, resetId: rows[0].id });
  } catch (err) {
    console.error('Error in verifyResetCode:', err);
    return res.status(500).json({ error: 'Failed to verify code.' });
  }
};


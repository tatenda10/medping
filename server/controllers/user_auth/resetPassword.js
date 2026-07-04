const bcrypt = require('bcryptjs');
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

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword, resetId } = req.body || {};

    if ((!email || !code) && !resetId) {
      return res.status(400).json({ error: 'Provide either (email + code) or resetId.' });
    }

    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    await ensurePasswordResetsTable();

    let resetRow = null;

    if (resetId) {
      const rows = await mysql.query(
        `SELECT id, user_id
         FROM password_resets
         WHERE id = ? AND used = 0 AND expires_at > NOW()
         LIMIT 1`,
        [String(resetId)]
      );
      resetRow = rows?.[0] || null;
    } else {
      const normalizedEmail = String(email).trim().toLowerCase();
      const users = await mysql.query(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [normalizedEmail]
      );

      if (!users || users.length === 0) {
        return res.status(400).json({ error: 'Invalid email or code.' });
      }

      const user = users[0];

      const rows = await mysql.query(
        `SELECT id, user_id
         FROM password_resets
         WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id, String(code).trim()]
      );
      resetRow = rows?.[0] || null;
    }

    if (!resetRow?.id || !resetRow?.user_id) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await mysql.transaction(async (conn) => {
      await conn.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, resetRow.user_id]
      );

      await conn.query(
        'UPDATE password_resets SET used = 1 WHERE id = ?',
        [resetRow.id]
      );
    });

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Error in resetPassword:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
};


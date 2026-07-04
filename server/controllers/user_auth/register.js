const bcrypt = require('bcryptjs');
const { query, transaction } = require('../../config/mysql');
const { generateToken } = require('../../middleware/auth');

/**
 * Register a new user with email and password
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Name, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();

    // Check if user already exists
    const existingRows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [
      normalizedEmail,
    ]);
    const existingUser = existingRows?.[0] || null;

    if (existingUser) {
      return res.status(409).json({ 
        message: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user + user profile in a transaction
    const created = await transaction(async (tx) => {
      const insertUserRes = await tx.execute(
        `INSERT INTO users (id, email, name, password_hash, auth_provider, is_verified, role, created_at, updated_at)
         VALUES (UUID(), ?, ?, ?, 'email', 0, 'user', NOW(), NOW())`,
        [normalizedEmail, trimmedName, password_hash]
      );

      // Fetch inserted user (we need the generated UUID)
      // MySQL UUID() is generated server-side; we retrieve by email.
      const userRows = await tx.query(
        `SELECT id, email, name, role, auth_provider, is_verified, created_at, updated_at
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [normalizedEmail]
      );
      const user = userRows?.[0];

      await tx.execute(
        `INSERT INTO user_profiles (id, user_id, onboarding_completed, created_at, updated_at)
         VALUES (UUID(), ?, 0, NOW(), NOW())`,
        [user.id]
      );

      return user;
    });

    // Generate JWT token
    const token = generateToken({
      id: created.id,
      email: created.email,
      role: created.role,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: created,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Error registering user', 
      error: error.message 
    });
  }
};

module.exports = { register };


const bcrypt = require('bcryptjs');
const { query } = require('../../config/mysql');
const { generateToken } = require('../../middleware/auth');

/**
 * Login user with email and password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Find user by email
    const rows = await query(
      `SELECT 
         u.id, u.email, u.name, u.password_hash, u.role,
         up.onboarding_completed
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [normalizedEmail]
    );
    const user = rows?.[0] || null;

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Check if user has password (email/password auth)
    if (!user.password_hash) {
      return res.status(401).json({ 
        message: 'This account does not have a password set. Please use a different sign-in method or reset your password.' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Remove password_hash from response
    const { password_hash: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        ...userWithoutPassword,
        onboarding_completed: !!user.onboarding_completed,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Error during login', 
      error: error.message 
    });
  }
};

module.exports = { login };


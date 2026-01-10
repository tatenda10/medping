const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        profile: true,
      },
    });

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Check if user has password (email/password auth)
    if (!user.password_hash) {
      return res.status(401).json({ 
        message: 'This account was created with social login. Please use Google or Apple to sign in.' 
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
        onboarding_completed: user.profile?.onboarding_completed || false,
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


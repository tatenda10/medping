const jwt = require('jsonwebtoken');
const config = require('../../config/env');

/**
 * Generate Apple client secret (JWT)
 */
const generateAppleClientSecret = () => {
  if (!config.APPLE_TEAM_ID || !config.APPLE_KEY_ID || !config.APPLE_PRIVATE_KEY) {
    throw new Error('Apple OAuth not properly configured');
  }

  const now = Math.floor(Date.now() / 1000);
  
  const token = jwt.sign(
    {
      iss: config.APPLE_TEAM_ID,
      iat: now,
      exp: now + 3600, // 1 hour
      aud: 'https://appleid.apple.com',
      sub: config.APPLE_CLIENT_ID,
    },
    config.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    {
      algorithm: 'ES256',
      keyid: config.APPLE_KEY_ID,
    }
  );

  return token;
};

/**
 * Initiate Apple OAuth flow
 * Redirects user to Apple OAuth page
 */
const initiateAppleOAuth = async (req, res) => {
  try {
    const appleClientId = config.APPLE_CLIENT_ID;
    const redirectUri = config.APPLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/user-auth/oauth/callback`;

    if (!appleClientId || !config.APPLE_TEAM_ID) {
      return res.status(500).json({ message: 'Apple OAuth not configured' });
    }

    // Generate state for CSRF protection
    const state = require('crypto').randomBytes(16).toString('hex');
    
    // Store state in session or cache (for production, use Redis)
    // For now, we'll pass it in the redirect URI
    req.session = req.session || {};
    req.session.appleOAuthState = state;

    // Build Apple OAuth URL
    const authUrl = new URL('https://appleid.apple.com/auth/authorize');
    authUrl.searchParams.set('client_id', appleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'name email');
    authUrl.searchParams.set('response_mode', 'form_post');
    authUrl.searchParams.set('state', state);

    // Redirect to Apple OAuth
    res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Apple OAuth:', error);
    res.status(500).json({ message: 'Error initiating OAuth flow' });
  }
};

module.exports = { initiateAppleOAuth, generateAppleClientSecret };


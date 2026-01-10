const config = require('../../config/env');

/**
 * Initiate Google OAuth flow
 * Redirects user to Google OAuth page
 */
const initiateGoogleOAuth = async (req, res) => {
  try {
    const googleClientId = config.GOOGLE_CLIENT_ID;
    const redirectUri = config.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/oauth/callback`;

    if (!googleClientId) {
      return res.status(500).json({ message: 'Google OAuth not configured' });
    }

    // Build Google OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account');

    // Redirect to Google OAuth
    res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    res.status(500).json({ message: 'Error initiating OAuth flow' });
  }
};

module.exports = { initiateGoogleOAuth };


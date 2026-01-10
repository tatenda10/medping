const { generateToken } = require('../../middleware/auth');
const prisma = require('../../config/database');
const config = require('../../config/env');

/**
 * Handle Google OAuth callback
 * Receives authorization code from Google, exchanges for tokens,
 * creates/updates user, and redirects to app with JWT token
 */
const handleGoogleOAuthCallback = async (req, res) => {
  const { code, error } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error);
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(error)}`;
    return res.redirect(errorRedirect);
  }

  if (!code) {
    console.error('No authorization code received');
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent('No authorization code received')}`;
    return res.redirect(errorRedirect);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.GOOGLE_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(errorData.error_description || 'Token exchange failed')}`;
      return res.redirect(errorRedirect);
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get user info from Google
    const userInfoResponse = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json();
      console.error('Failed to get user info:', errorData);
      const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent('Failed to get user info')}`;
      return res.redirect(errorRedirect);
    }

    const userInfo = await userInfoResponse.json();
    const { email, name, picture } = userInfo;

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // Create user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          profile_image_url: picture || null,
          auth_provider: 'google',
          role: 'user',
          is_verified: true, // OAuth users are verified
        },
      });

      // Create user profile
      await prisma.userProfile.create({
        data: {
          user_id: user.id,
          onboarding_completed: false,
        },
      });
    } else {
      // Update user info if exists
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: name || user.name,
          profile_image_url: picture || user.profile_image_url,
          auth_provider: 'google',
          is_verified: true,
        },
      });
    }

    // Get user profile data (onboarding status, etc.)
    const profile = await prisma.userProfile.findUnique({
      where: { user_id: user.id },
    });

    const onboardingCompleted = profile?.onboarding_completed || false;

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Prepare user data for redirect
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profile_image_url: user.profile_image_url,
      role: user.role,
      auth_provider: user.auth_provider,
      onboarding_completed: onboardingCompleted,
    };

    // Redirect to app with token and user data
    const appRedirect = `${config.APP_DEEP_LINK_SCHEME}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userData))}`;
    return res.redirect(appRedirect);

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(error.message || 'Internal server error')}`;
    return res.redirect(errorRedirect);
  }
};

module.exports = { handleGoogleOAuthCallback };


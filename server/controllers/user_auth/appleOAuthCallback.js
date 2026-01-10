const { generateToken } = require('../../middleware/auth');
const prisma = require('../../config/database');
const config = require('../../config/env');
const { generateAppleClientSecret } = require('./appleOAuthInitiate');

/**
 * Handle Apple OAuth callback
 * Apple uses POST method for callback, but we handle both GET and POST
 */
const handleAppleOAuthCallback = async (req, res) => {
  // Apple uses POST, but handle both for flexibility
  const { code, error, state } = req.method === 'POST' ? req.body : req.query;

  // Handle OAuth errors
  if (error) {
    console.error('Apple OAuth error:', error);
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(error)}&provider=apple`;
    return res.redirect(errorRedirect);
  }

  if (!code) {
    console.error('No authorization code received from Apple');
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent('No authorization code received')}&provider=apple`;
    return res.redirect(errorRedirect);
  }

  try {
    // Generate Apple client secret
    const clientSecret = generateAppleClientSecret();

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.APPLE_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(errorData.error_description || 'Token exchange failed')}&provider=apple`;
      return res.redirect(errorRedirect);
    }

    const tokenData = await tokenResponse.json();
    const { id_token } = tokenData;

    // Decode ID token to get user info
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(id_token);
    
    if (!decoded) {
      throw new Error('Failed to decode Apple ID token');
    }

    const { email, sub: appleUserId } = decoded;
    
    // Apple may not always return email in subsequent logins
    // In that case, we need to find user by apple_user_id if we stored it
    // For now, we'll use email if available, or create a placeholder

    let user;
    
    if (email) {
      // Check if user exists by email
      user = await prisma.user.findUnique({
        where: { email },
      });
    }

    // If user doesn't exist, create new user
    if (!user) {
      // Apple doesn't always provide name/email in subsequent logins
      // We'll need to handle this case - for now, use email or generate placeholder
      const userEmail = email || `apple_${appleUserId}@appleid.apple.com`;
      
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: decoded.name ? `${decoded.name.givenName || ''} ${decoded.name.familyName || ''}`.trim() : null,
          auth_provider: 'apple',
          role: 'user',
          is_verified: true,
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
          auth_provider: 'apple',
          is_verified: true,
        },
      });
    }

    // Get user profile data
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
    const appRedirect = `${config.APP_DEEP_LINK_SCHEME}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userData))}&onboarding_completed=${onboardingCompleted}&has_selected_companion=false`;
    return res.redirect(appRedirect);

  } catch (error) {
    console.error('Apple OAuth callback error:', error);
    const errorRedirect = `${config.APP_DEEP_LINK_SCHEME}?error=${encodeURIComponent(error.message || 'Internal server error')}&provider=apple`;
    return res.redirect(errorRedirect);
  }
};

module.exports = { handleAppleOAuthCallback };


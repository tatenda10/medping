const express = require('express');
const router = express.Router();
const { initiateGoogleOAuth } = require('../controllers/user_auth/googleOAuthInitiate');
const { handleGoogleOAuthCallback } = require('../controllers/user_auth/googleOAuthCallback');
const { initiateAppleOAuth } = require('../controllers/user_auth/appleOAuthInitiate');
const { handleAppleOAuthCallback } = require('../controllers/user_auth/appleOAuthCallback');
const { register } = require('../controllers/user_auth/register');
const { login } = require('../controllers/user_auth/login');

// Email/Password Authentication
router.post('/register', register);
router.post('/login', login);

// OAuth initiation endpoints
router.get('/oauth/google', initiateGoogleOAuth);
router.get('/oauth/apple', initiateAppleOAuth);

// OAuth callback endpoints
// Google uses GET, Apple uses POST
router.get('/oauth/callback', async (req, res) => {
  // Check if this is a Google callback (has code in query)
  if (req.query.code && !req.query.provider) {
    return handleGoogleOAuthCallback(req, res);
  }
  // If provider is specified, route accordingly
  const provider = req.query.provider || 'google';
  if (provider === 'google') {
    return handleGoogleOAuthCallback(req, res);
  } else if (provider === 'apple') {
    // Apple typically uses POST, but handle GET as fallback
    return handleAppleOAuthCallback(req, res);
  }
});

// Apple OAuth callback (POST method)
router.post('/oauth/callback', async (req, res) => {
  // Apple uses POST for callback
  return handleAppleOAuthCallback(req, res);
});

module.exports = router;


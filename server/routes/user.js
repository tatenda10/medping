const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getUserProfile, updateUserProfile, completeOnboarding } = require('../controllers/user/profile');
const deleteAccount = require('../controllers/user/deleteAccount');

/**
 * GET /user/me
 * Get current user profile
 */
router.get('/me', authenticate, getUserProfile);

/**
 * PUT /user/profile
 * Update user profile
 */
router.put('/profile', authenticate, updateUserProfile);

/**
 * POST /user/onboarding/complete
 * Complete user onboarding
 */
router.post('/onboarding/complete', authenticate, completeOnboarding);

/**
 * DELETE /user/account
 * Delete user account and all associated data
 */
router.delete('/account', authenticate, deleteAccount);

module.exports = router;


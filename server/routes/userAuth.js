const express = require('express');
const router = express.Router();
const { register } = require('../controllers/user_auth/register');
const { login } = require('../controllers/user_auth/login');
const { forgotPassword } = require('../controllers/user_auth/forgotPassword');
const { verifyResetCode } = require('../controllers/user_auth/verifyResetCode');
const { resetPassword } = require('../controllers/user_auth/resetPassword');

// Email/Password Authentication
router.post('/register', register);
router.post('/login', login);

// Password reset
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

module.exports = router;


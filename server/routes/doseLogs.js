const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createDoseLog } = require('../controllers/doseLogs/create');

/**
 * POST /dose-logs
 * Create a new dose log entry
 */
router.post('/', authenticate, createDoseLog);

module.exports = router;


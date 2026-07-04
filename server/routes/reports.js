const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateHealthReportPDF } = require('../controllers/reports/generatePDF');

/**
 * GET /reports/pdf
 * Generate and download health report PDF
 * Query params: month (1-12), year (e.g., 2023)
 */
router.get('/pdf', authenticate, generateHealthReportPDF);

module.exports = router;


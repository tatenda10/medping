const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createVitalsLog } = require('../controllers/vitals/create');
const { listVitalsLogs } = require('../controllers/vitals/list');

// Create vitals log
router.post('/', authenticate, createVitalsLog);

// List vitals logs
router.get('/', authenticate, listVitalsLogs);

module.exports = router;


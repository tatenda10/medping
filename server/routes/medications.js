const express = require('express');
const router = express.Router();
const { createMedication } = require('../controllers/medications/create');
const { listMedications } = require('../controllers/medications/list');
const { getMedication } = require('../controllers/medications/getOne');
const { updateMedication } = require('../controllers/medications/update');
const { authenticate } = require('../middleware/auth');

// List medications
router.get('/', authenticate, listMedications);

// Get single medication
router.get('/:id', authenticate, getMedication);

// Create medication
router.post('/', authenticate, createMedication);

// Update medication
router.put('/:id', authenticate, updateMedication);

module.exports = router;


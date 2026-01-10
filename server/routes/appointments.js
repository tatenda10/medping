const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createAppointment, listAppointments, updateAppointment, deleteAppointment } = require('../controllers/appointments');

// Create appointment
router.post('/', authenticate, createAppointment);

// List appointments
router.get('/', authenticate, listAppointments);

// Update appointment
router.put('/:id', authenticate, updateAppointment);

// Delete appointment
router.delete('/:id', authenticate, deleteAppointment);

module.exports = router;


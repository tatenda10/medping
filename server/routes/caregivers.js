const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Import controllers
const sendInvitation = require('../controllers/caregivers/sendInvitation');
const acceptInvitation = require('../controllers/caregivers/acceptInvitation');
const rejectInvitation = require('../controllers/caregivers/rejectInvitation');
const listInvitations = require('../controllers/caregivers/listInvitations');
const removeCaregiver = require('../controllers/caregivers/removeCaregiver');
const createCaregiverDoseLog = require('../controllers/caregivers/createDoseLog');

// All routes require authentication
router.post('/invite', authenticate, sendInvitation);
router.post('/accept/:invitationId', authenticate, acceptInvitation);
router.post('/reject/:invitationId', authenticate, rejectInvitation);
router.get('/invitations', authenticate, listInvitations);
router.delete('/remove/:relationshipId', authenticate, removeCaregiver);
router.post('/dose-logs', authenticate, createCaregiverDoseLog);

module.exports = router;


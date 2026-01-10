const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const createRefill = require('../controllers/refills/create');
const listRefills = require('../controllers/refills/list');
const updateRefill = require('../controllers/refills/update');
const deleteRefill = require('../controllers/refills/delete');

// All routes require authentication
router.post('/', authenticate, createRefill);
router.get('/', authenticate, listRefills);
router.put('/:id', authenticate, updateRefill);
router.delete('/:id', authenticate, deleteRefill);

module.exports = router;


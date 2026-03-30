/**
 * Health Routes
 * 
 * Routes for server health check and status.
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', healthController.getHealth);

module.exports = router;

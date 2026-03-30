/**
 * Statistics Routes
 * 
 * Routes for ticket statistics and analytics.
 */

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

/**
 * GET /api/stats/summary
 * Get comprehensive ticket statistics
 * 
 * Returns:
 * - total: Total number of tickets
 * - byStatus: Count of tickets grouped by status
 * - byPriority: Count of tickets grouped by priority
 * - byCategory: Count of tickets grouped by category
 * - percentages: Percentage distribution for each grouping
 */
router.get('/summary', statsController.getSummary);

module.exports = router;

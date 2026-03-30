/**
 * Statistics Controller
 * 
 * Handles HTTP requests for ticket statistics and analytics.
 */

const ticketModel = require('../models/ticketModel');

/**
 * Get comprehensive ticket statistics
 * GET /api/stats/summary
 */
async function getSummary(req, res, next) {
  try {
    const stats = await ticketModel.getTicketStats();
    res.json(stats);

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary
};

/**
 * Ticket Routes
 * 
 * Routes for ticket CRUD operations.
 * Uses ITSM schema with id as primary key.
 */

const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { body, query, param } = require('express-validator');

/**
 * GET /api/tickets
 * List all tickets with filters
 * 
 * Query Parameters:
 * - status: Filter by status (Open, Closed)
 * - priority: Filter by priority (1, 2, 3, 4, 5, NS, NA)
 * - category: Filter by category (incident, request for information, etc.)
 * - id: Filter by ticket ID (e.g., 4)
 * - search: Search in title and description
 * - limit: Maximum number of results (default: 100, max: 1000)
 * - offset: Number of records to skip (for pagination)
 * - sortBy: Field to sort by (default: created_at)
 * - sortOrder: ASC or DESC (default: DESC)
 */
router.get('/',
  [
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('sortBy').optional().isIn(['id', 'title', 'status', 'priority', 'category', 'created_at', 'updated_at']),
    query('sortOrder').optional().isIn(['ASC', 'DESC'])
  ],
  ticketController.listTickets
);

/**
 * GET /api/tickets/:id
 * Get single ticket by id
 */
router.get('/:id',
  [
    param('id').notEmpty().withMessage('Ticket ID is required')
  ],
  ticketController.getTicket
);

/**
 * POST /api/tickets
 * Create a new ticket
 */
router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('priority').optional().trim(),
    body('category').optional().trim(),
    body('impact').optional().trim(),
    body('urgency').optional().trim()
  ],
  ticketController.createTicket
);

/**
 * PUT /api/tickets/:id
 * Update a ticket
 */
router.put('/:id',
  [
    param('id').notEmpty().withMessage('Ticket ID is required'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().trim(),
    body('status').optional().trim(),
    body('priority').optional().trim(),
    body('category').optional().trim(),
    body('impact').optional().trim(),
    body('urgency').optional().trim()
  ],
  ticketController.updateTicket
);

/**
 * DELETE /api/tickets/:id
 * Delete a ticket
 */
router.delete('/:id',
  [
    param('id').notEmpty().withMessage('Ticket ID is required')
  ],
  ticketController.deleteTicket
);

module.exports = router;

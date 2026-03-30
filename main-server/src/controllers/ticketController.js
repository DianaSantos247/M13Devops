/**
 * Ticket Controller
 * 
 * Handles HTTP requests for ticket operations.
 * Implements conditional field visibility: closed_at only appears if status is 'Closed'.
 */

const ticketModel = require('../models/ticketModel');
const webhookService = require('../services/webhookService');
const { validationResult } = require('express-validator');

/**
 * List all tickets with filters
 * GET /api/tickets
 */
async function listTickets(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      category: req.query.category,
      id: req.query.id,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit,
      offset: req.query.offset
    };

    const result = await ticketModel.getAllTickets(filters);
    res.json(result);

  } catch (error) {
    next(error);
  }
}

/**
 * Get single ticket by id
 * GET /api/tickets/:id
 */
async function getTicket(req, res, next) {
  try {
    const ticketId = req.params.id;
    
    if (!ticketId || ticketId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Ticket ID is required'
      });
    }

    const ticket = await ticketModel.getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Ticket with ID ${ticketId} not found`
      });
    }

    res.json(ticket);

  } catch (error) {
    next(error);
  }
}

/**
 * Create a new ticket
 * POST /api/tickets
 */
async function createTicket(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {title, description, priority, category, impact, urgency } = req.body;

    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title is required'
      });
    }

    const ticketData = {
      title: title.trim(),
      description: description ? description.trim() : null,
      priority: priority || '3',
      category: category || 'incident',
      impact: impact || null,
      urgency: urgency || null
    };

    const createdTicket = await ticketModel.createTicket(ticketData);
    const webhookData = { ...ticketData, id: createdTicket.id };
    // Trigger webhook notification
    await webhookService.dispatchEvent('ticket.created', webhookData);

    res.status(201).json(createdTicket);

  } catch (error) {
    next(error);
  }
}

/**
 * Update a ticket
 * PUT /api/tickets/:id
 */
async function updateTicket(req, res, next) {
  try {
    const ticketId = req.params.id;
    
    if (!ticketId || ticketId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Ticket ID is required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {};
    const allowedFields = ['title', 'description', 'status', 'priority', 'category', 'impact', 'urgency'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one valid field must be provided for update'
      });
    }

    // 1. Buscar estado anterior
  const oldTicket = await ticketModel.getTicketById(ticketId);

  if (!oldTicket) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Ticket with ID ${ticketId} not found`
    });
  }

  // 2. Atualizar
  const updatedTicket = await ticketModel.updateTicket(ticketId, updateData);

  // 3. Webhook com before/after
  await webhookService.dispatchEvent('ticket.updated', {
    before: oldTicket,
    after: updatedTicket
  });

  // 4. Resposta da API
  res.json({
    before: oldTicket,
    after: updatedTicket
  });

  } catch (error) {
    next(error);
  }
}

/**
 * Delete a ticket
 * DELETE /api/tickets/:id
 */
async function deleteTicket(req, res, next) {
  try {
    const ticketId = req.params.id;
    
    if (!ticketId || ticketId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Ticket ID is required'
      });
    }

    // Get ticket before deletion for webhook
    const ticket = await ticketModel.getTicketById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Ticket with ID ${ticketId} not found`
      });
    }

    const deleted = await ticketModel.deleteTicket(ticketId);
    
    if (deleted) {
      // Trigger webhook notification
      await webhookService.dispatchEvent('ticket.deleted', { id: ticketId, ...ticket });
      
      res.json({
        message: 'Ticket deleted successfully',
        id: ticketId
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete ticket'
      });
    }

  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket
};

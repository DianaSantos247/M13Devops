/**
 * Webhook Controller
 * 
 * Handles HTTP requests for webhook registration and management.
 */

const webhookModel = require('../models/webhookModel');
const { body, validationResult } = require('express-validator');

/**
 * List all registered webhooks
 * GET /api/webhooks
 */
async function listWebhooks(req, res, next) {
  try {
    const webhooks = await webhookModel.getAllWebhooks();
    res.json(webhooks);

  } catch (error) {
    next(error);
  }
}

/**
 * Get single webhook by ID
 * GET /api/webhooks/:id
 */
async function getWebhook(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Webhook ID must be a positive integer'
      });
    }

    const webhook = await webhookModel.getWebhookById(id);
    
    if (!webhook) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Webhook with ID ${id} not found`
      });
    }

    res.json(webhook);

  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/webhooks
 * Register a new webhook
 */
const registerWebhookValidators = [
  body('payloadUrl').custom((value) => {
    if (!value || value.trim() === '') {
      throw new Error('payloadUrl is required');
    }
    try {
      const url = new URL(value);
      const hostname = url.hostname;
      if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('.')) {
        throw new Error('payloadUrl must be a valid publicly accessible URL');
      }
      return true;
    } catch {
      throw new Error('payloadUrl must be a valid URL');
    }
  }),
  body('secret').trim().notEmpty().withMessage('Secret is required'),
  body('events').isArray({ min: 1 }).withMessage('Events must be a non-empty array'),
  body('events.*').isIn(['ticket.created', 'ticket.updated', 'ticket.deleted']).withMessage('Invalid event type'),
  body('description').optional().trim()
];

async function createWebhook(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { payloadUrl, secret, events, description } = req.body;

  // Validate event types (extra safety)
  const validEvents = ['ticket.created', 'ticket.updated', 'ticket.deleted'];
  for (const event of events) {
    if (!validEvents.includes(event)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid event type: ${event}`
      });
    }
  }

  const webhookData = {
    payloadUrl: payloadUrl.trim(),
    secret: secret.trim(),
    events,
    description: description ? description.trim() : null
  };

  try {
    const createdWebhook = await webhookModel.createWebhook(webhookData);
    res.status(201).json(createdWebhook);
  } catch (err) {
    next(err);
  }
}

/**
 * Update a webhook
 * PUT /api/webhooks/:id
 */
async function updateWebhook(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Webhook ID must be a positive integer'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { payloadUrl, secret, events, description } = req.body;
    const updateData = {};

    if (payloadUrl !== undefined) {
      try {
        new URL(payloadUrl);
        updateData.payloadUrl = payloadUrl.trim();
      } catch (e) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'payloadUrl must be a valid URL'
        });
      }
    }

    if (secret !== undefined) {
      updateData.secret = secret.trim();
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'events must be a non-empty array'
        });
      }

      const validEvents = ['ticket.created', 'ticket.updated', 'ticket.deleted'];
      for (const event of events) {
        if (!validEvents.includes(event)) {
          return res.status(400).json({
            error: 'Validation Error',
            message: `Invalid event type: ${event}`
          });
        }
      }

      updateData.events = events;
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one valid field must be provided for update'
      });
    }

    const updatedWebhook = await webhookModel.updateWebhook(id, updateData);
    
    if (!updatedWebhook) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Webhook with ID ${id} not found`
      });
    }

    res.json(updatedWebhook);

  } catch (error) {
    next(error);
  }
}

/**
 * Delete a webhook
 * DELETE /api/webhooks/:id
 */
async function deleteWebhook(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid ID',
        message: 'Webhook ID must be a positive integer'
      });
    }

    const deleted = await webhookModel.deleteWebhook(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Webhook with ID ${id} not found`
      });
    }

    res.json({
      message: 'Webhook deleted successfully',
      id
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  listWebhooks,
  getWebhook,
  createWebhook,
  registerWebhookValidators,
  updateWebhook,
  deleteWebhook
};

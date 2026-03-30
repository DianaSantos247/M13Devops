/**
 * Webhook Routes
 * 
 * Routes for webhook registration and management.
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { body, param } = require('express-validator');

/**
 * GET /api/webhooks
 * List all registered webhooks
 */
router.get('/',
  webhookController.listWebhooks
);

/**
 * GET /api/webhooks/:id
 * Get single webhook by ID
 */
router.get('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Webhook ID must be a positive integer')
  ],
  webhookController.getWebhook
);

/**
 * POST /api/webhooks
 * Register a new webhook
 * 
 * Request Body:
 * - payloadUrl: The URL to receive webhook notifications
 * - secret: Secret key for signing webhook payloads
 * - events: Array of event types to subscribe to
 * - description: Optional description
 */
router.post('/',
  [
    body('payloadUrl').custom((value) => {
      if (!value || value.trim() === '') {
        throw new Error('payloadUrl is required');
      }
      try {
        const url = new URL(value);
        const hostname = url.hostname;
        // allow localhost and 127.0.0.1
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
  ],
  webhookController.createWebhook
);

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Webhook ID must be a positive integer'),
    body('payloadUrl').optional().isURL().withMessage('Valid payloadUrl is required'),
    body('secret').optional().trim().notEmpty().withMessage('Secret cannot be empty'),
    body('events').optional().isArray({ min: 1 }).withMessage('Events must be a non-empty array'),
    body('events.*').optional().isIn(['ticket.created', 'ticket.updated', 'ticket.deleted']).withMessage('Invalid event type'),
    body('description').optional().trim()
  ],
  webhookController.updateWebhook
);

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Webhook ID must be a positive integer')
  ],
  webhookController.deleteWebhook
);

module.exports = router;

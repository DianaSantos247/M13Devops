/**
 * Express Application Setup for Webhook Receiver
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Store recent webhooks in memory for health check
const recentWebhooks = [];
const MAX_RECENT_WEBHOOKS = 10;

/**
 * Generate HMAC signature for validation
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Validate webhook signature
 */
function validateSignature(payload, signature, secret) {
  const expectedSignature = generateSignature(payload, secret);
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

/**
 * Format webhook payload for console display
 */
function formatWebhookDisplay(webhook) {
  const lines = [];
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('WEBHOOK RECEIVED');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(`Signature Validated`);
  lines.push(`Event: ${webhook.event}`);
  lines.push(`Timestamp: ${webhook.timestamp}`);
  lines.push('──────────────────────────────────────────────────────────────────');
  lines.push('DATA:');
  lines.push(JSON.stringify(webhook.data, null, 2));
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

/**
 * POST /webhook
 * Main webhook endpoint that receives and validates notifications
 */
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const event = req.headers['x-webhook-event'];
  const timestamp = req.headers['x-webhook-timestamp'];
  
  // Get raw body for signature validation
  const rawBody = JSON.stringify(req.body);
  const secret = process.env.WEBHOOK_SECRET;
  
  // Validate signature
  if (!signature) {
    console.log('\nWEBHOOK RECEIVED - NO SIGNATURE');
    console.log(`Event: ${event || 'unknown'}`);
    console.log(`Timestamp: ${timestamp || 'unknown'}`);
    console.log('Data:', req.body);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return res.status(400).json({
      error: 'Missing signature',
      message: 'X-Webhook-Signature header is required'
    });
  }
  
  // Verify signature
  const isValid = validateSignature(rawBody, signature, secret);
  
  if (!isValid) {
    console.log('\n❌ WEBHOOK REJECTED - INVALID SIGNATURE');
    console.log(`Event: ${event}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('Attempted signature:', signature);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return res.status(401).json({
      error: 'Invalid signature',
      message: 'Webhook signature validation failed'
    });
  }
  
  // Create webhook object
  const webhook = {
    event: event || 'unknown',
    timestamp: timestamp || new Date().toISOString(),
    data: req.body,
    receivedAt: new Date().toISOString()
  };
  
  // Store in recent webhooks (for health check)
  recentWebhooks.unshift(webhook);
  if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
    recentWebhooks.pop();
  }
  
  // Display in console
  console.log('\n' + formatWebhookDisplay(webhook) + '\n');
  
  // Respond to sender
  res.status(200).json({
    status: 'received',
    event: webhook.event,
    timestamp: webhook.receivedAt
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook receiver is running',
    port: process.env.PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    recentWebhooks: recentWebhooks.length,
    lastWebhook: recentWebhooks[0] || null
  });
});

/**
 * GET /history
 * View recent webhook history
 */
app.get('/history', (req, res) => {
  res.json({
    count: recentWebhooks.length,
    webhooks: recentWebhooks
  });
});

/**
 * GET /
 * API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Webhook Receiver',
    version: '1.0.0',
    description: 'Receives and displays webhook notifications from Ticket Manager',
    endpoints: {
      webhook: 'POST /webhook',
      health: 'GET /health',
      history: 'GET /history'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;

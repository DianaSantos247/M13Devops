/**
 * Webhook Service
 * 
 * Handles dispatching webhook notifications to registered endpoints.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const webhookModel = require('../models/webhookModel');
const { getWebhookHeaders } = require('../utils/hmacUtil');
const logger = require('../utils/logger');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * Dispatch an event to all subscribed webhooks
 * @param {string} event - Event type (ticket.created, ticket.updated, ticket.deleted)
 * @param {object} data - Event data
 */
async function dispatchEvent(event, data) {
  try {
    // Get all webhooks subscribed to this event
    const webhooks = await webhookModel.getSubscribedWebhooks(event);
    
    if (webhooks.length === 0) {
      logger.debug(`No webhooks registered for event: ${event}`);
      return;
    }

    // Build webhook payload
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };
    const payloadString = JSON.stringify(payload);

    // Dispatch to all subscribed webhooks
    const dispatchPromises = webhooks.map(webhook => 
      sendWebhook(webhook, payload, payloadString)
    );

    // Wait for all webhooks to be sent (non-blocking for main thread)
    Promise.allSettled(dispatchPromises).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(`Webhook delivery failed to ${webhooks[index].payloadUrl}`, {
            error: result.reason.message,
            event,
            webhookId: webhooks[index].id
          });
        } else {
          logger.info(`Webhook delivered successfully to ${webhooks[index].payloadUrl}`, {
            event,
            webhookId: webhooks[index].id
          });
        }
      });
    });

    logger.info(`Dispatched ${event} to ${webhooks.length} webhook(s)`);

  } catch (error) {
    logger.error('Error dispatching webhook event:', error);
    // Don't throw - webhook failure shouldn't break the main operation
  }
}

/**
 * Send a single webhook notification
 * @param {object} webhook - Webhook configuration
 * @param {object} payload - Event payload object
 * @param {string} payloadString - JSON string of payload
 */
async function sendWebhook(webhook, payload, payloadString) {
  return new Promise((resolve, reject) => {
    try {
      const targetUrl = new URL(webhook.payloadUrl);
      const client = targetUrl.protocol === 'https:' ? https : http;
      
      // Generate signature using the webhook's specific secret
      const signature = require('../utils/hmacUtil').generateSignature(payloadString, webhook.secret);
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'Content-Length': Buffer.byteLength(payloadString)
      };

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetUrl.pathname,
        method: 'POST',
        headers,
        timeout: 5000 // 5 second timeout
      };

      const req = client.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', chunk => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: responseBody });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody || 'No response body'}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(payloadString);
      req.end();

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Test webhook connectivity
 * @param {string} url - Webhook URL to test
 * @param {string} secret - Secret for signing
 * @returns {Promise<object>} Test result
 */
async function testWebhook(url, secret) {
  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook' }
  };
  
  return sendWebhook({ payloadUrl: url, secret }, testPayload, JSON.stringify(testPayload));
}

module.exports = {
  dispatchEvent,
  testWebhook
};

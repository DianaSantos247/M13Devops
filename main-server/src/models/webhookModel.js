/**
 * Webhook Model
 * 
 * Database operations for webhook registration and management.
 */

const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all registered webhooks
 * @returns {Promise<Array>} Array of webhooks
 */
async function getAllWebhooks() {
  const db = getDatabase();
  const webhooks = await db.all('SELECT * FROM webhooks ORDER BY created_at DESC');
  return webhooks.map(formatWebhook);
}

/**
 * Get webhook by ID
 * @param {number} id - Webhook ID
 * @returns {Promise<object|null>} Webhook or null
 */
async function getWebhookById(id) {
  const db = getDatabase();
  const webhook = await db.get('SELECT * FROM webhooks WHERE id = ?', [id]);
  return webhook ? formatWebhook(webhook) : null;
}

/**
 * Get webhooks subscribed to a specific event
 * @param {string} event - Event type
 * @returns {Promise<Array>} Array of webhooks
 */
async function getWebhooksByEvent(event) {
  const db = getDatabase();
  const webhooks = await db.all(
    'SELECT * FROM webhooks WHERE events LIKE ?',
    [`%${event}%`]
  );
  return webhooks.map(formatWebhook);
}

/**
 * Register a new webhook
 * @param {object} webhookData - Webhook data
 * @returns {Promise<object>} Created webhook
 */
async function createWebhook(webhookData) {
  const db = getDatabase();
  
  const { payloadUrl, secret, events, description } = webhookData;
  
  // Convert events array to JSON string
  const eventsJson = JSON.stringify(events);
  
  const result = await db.run(
    `INSERT INTO webhooks (payload_url, secret, events, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [payloadUrl, secret, eventsJson, description || null]
  );

  const createdWebhook = await getWebhookById(result.lastID);
  logger.info('Webhook registered', { id: createdWebhook.id, url: payloadUrl });
  
  return createdWebhook;
}

/**
 * Update a webhook
 * @param {number} id - Webhook ID
 * @param {object} updateData - Fields to update
 * @returns {Promise<object|null>} Updated webhook or null
 */
async function updateWebhook(id, updateData) {
  const db = getDatabase();
  
  const existingWebhook = await getWebhookById(id);
  if (!existingWebhook) {
    return null;
  }

  const updates = [];
  const values = [];

  if (updateData.payloadUrl !== undefined) {
    updates.push('payload_url = ?');
    values.push(updateData.payloadUrl);
  }
  
  if (updateData.secret !== undefined) {
    updates.push('secret = ?');
    values.push(updateData.secret);
  }
  
  if (updateData.events !== undefined) {
    updates.push('events = ?');
    values.push(JSON.stringify(updateData.events));
  }
  
  if (updateData.description !== undefined) {
    updates.push('description = ?');
    values.push(updateData.description);
  }

  if (updates.length === 0) {
    return existingWebhook;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await db.run(
    `UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const updatedWebhook = await getWebhookById(id);
  logger.info('Webhook updated', { id: updatedWebhook.id });
  
  return updatedWebhook;
}

/**
 * Delete a webhook
 * @param {number} id - Webhook ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteWebhook(id) {
  const db = getDatabase();
  
  const existingWebhook = await getWebhookById(id);
  if (!existingWebhook) {
    return false;
  }

  await db.run('DELETE FROM webhooks WHERE id = ?', [id]);
  logger.info('Webhook deleted', { id });
  
  return true;
}

/**
 * Get all webhooks that should receive a specific event
 * @param {string} event - Event type
 * @returns {Promise<Array>} Array of webhooks with secrets
 */
async function getSubscribedWebhooks(event) {
  const db = getDatabase();
  
  const webhooks = await db.all(
    `SELECT * FROM webhooks WHERE events LIKE ?`,
    [`%${event}%`]
  );
  
  return webhooks.map(w => ({
    id: w.id,
    payloadUrl: w.payload_url,
    secret: w.secret,
    events: JSON.parse(w.events)
  }));
}

/**
 * Format webhook for API response
 * @param {object} webhook - Raw database webhook
 * @returns {object} Formatted webhook
 */
function formatWebhook(webhook) {
  return {
    id: webhook.id,
    payloadUrl: webhook.payload_url,
    events: JSON.parse(webhook.events),
    description: webhook.description,
    created_at: webhook.created_at,
    updated_at: webhook.updated_at
  };
}

module.exports = {
  getAllWebhooks,
  getWebhookById,
  getWebhooksByEvent,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getSubscribedWebhooks
};

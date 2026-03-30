/**
 * HMAC Utility
 * 
 * Generates and validates HMAC signatures for webhook payloads.
 */

const crypto = require('crypto');

/**
 * Generate HMAC-SHA256 signature for a payload
 * @param {string} payload - JSON string to sign
 * @param {string} secret - Secret key for signing
 * @returns {string} Hex-encoded signature
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Validate HMAC signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature to validate (hex)
 * @param {string} secret - Secret key for validation
 * @returns {boolean} True if valid, false otherwise
 */
function validateSignature(payload, signature, secret) {
  const expectedSignature = generateSignature(payload, secret);
  
  // Use timing-safe comparison to prevent timing attacks
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
 * Generate webhook headers with signature
 * @param {object} payload - Webhook payload object
 * @param {string} secret - Secret key for signing
 * @returns {object} Headers object with signature
 */
function getWebhookHeaders(payload, secret) {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, secret);
  
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': new Date().toISOString()
  };
}

module.exports = {
  generateSignature,
  validateSignature,
  getWebhookHeaders
};

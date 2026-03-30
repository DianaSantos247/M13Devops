#!/usr/bin/env node

/**
 * Ticket Manager - Main Server Entry Point
 */

const app = require('./src/app');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`Ticket Manager Server running on port ${PORT}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`Health Check: http://localhost:${PORT}/health`);
  logger.info(`Webhook Endpoint: http://localhost:${PORT}/api/webhooks`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
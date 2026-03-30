#!/usr/bin/env node

/**
 * Webhook Receiver Server
 * 
 * This server receives webhook notifications from the main ticket manager
 * and displays them in a formatted console output.
 */

require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT;

// Start the server
app.listen(PORT, () => {
  console.log('='.repeat(80));
  console.log('Webhook Receiver Server Started');
  console.log('='.repeat(80));
  console.log(`Listening on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/webhook`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  console.log('='.repeat(80));
  console.log('Waiting for webhook notifications...\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  process.exit(0);
});

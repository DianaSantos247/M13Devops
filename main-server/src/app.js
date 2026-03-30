/**
 * Express Application Setup
 * 
 * Configures the Express application with middleware and routes.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

require('dotenv').config();

// 🔹 Initialization imports
const { loadInitialData } = require('./services/csvLoader');
const { initializeDatabase } = require('./config/database');

// Import routes
const healthRoutes = require('./routes/healthRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const statsRoutes = require('./routes/statsRoutes');

// Import utilities
const logger = require('./utils/logger');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// Create Express app
const app = express();

/**
 * 🔹 Fire-and-forget initialization
 * No async / await by design
 */
initializeDatabase()
  .then(() => {
    logger.info('Database initialized successfully');
    return loadInitialData();
  })
  .then(() => {
    logger.info('Initial data loaded successfully');
  })
  .catch((error) => {
    logger.error('Application initialization failed:', error);
    process.exit(1);
  });

// Security middleware
app.use(helmet());

// CORS configuration, allows use of https protocol, instead of http
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Signature']
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  })
);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Information endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Ticket Manager API',
    version: '1.0.0',
    description: 'REST API for ticket management with webhook support',
    endpoints: {
      health: '/health',
      tickets: '/api/tickets',
      webhooks: '/api/webhooks',
      stats: '/api/stats',
      documentation: '/api-docs'
    }
  });
});

// Mount routes
app.use('/health', healthRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/stats', statsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;

/**
 * Logger Utility
 * 
 * Simple logging utility using console with structured output.
 */

const logger = {
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
      timestamp,
      level: 'INFO',
      message,
      ...meta
    }));
  },

  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.error(JSON.stringify({
      timestamp,
      level: 'ERROR',
      message,
      ...meta
    }));
  },

  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.warn(JSON.stringify({
      timestamp,
      level: 'WARN',
      message,
      ...meta
    }));
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(JSON.stringify({
        timestamp,
        level: 'DEBUG',
        message,
        ...meta
      }));
    }
  }
};

module.exports = logger;

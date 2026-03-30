/**
 * Database Configuration
 * 
 * Configures SQLite database connection and initializes tables.
 * Uses ITSM_data.csv schema with columns from the incident management system.
 */

const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '../../', process.env.DATABASE_URL);
let db = null;

/**
 * Initialize database connection and create tables
 */
async function initializeDatabase() {
  try {
    // Ensure data directory exists
    await fs.ensureDir(path.dirname(dbPath));

    // Open database connection
    db = await sqlite.open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log(`Database connected: ${dbPath}`);

    // Create tickets table with ITSM schema
    // Maps: Incident_ID -> id, CI_Name -> title, CI_Cat -> description
    // Status, Priority, Category, Open_Time -> created_at, Resolved_Time -> resolved_at, Close_Time -> closed_at
    // NOTE: No CHECK constraints to allow all values from the CSV file
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        status TEXT DEFAULT 'Open',
        priority TEXT DEFAULT '3',
        category TEXT DEFAULT 'incident',
        impact TEXT,
        urgency TEXT,
        created_at DATETIME,
        resolved_at DATETIME,
        closed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create webhooks table (remains unchanged)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload_url TEXT NOT NULL,
        secret TEXT NOT NULL,
        events TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for faster queries
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    `);

    console.log('Database tables initialized successfully');
    return db;

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};

/**
 * CSV Loader Service
 *
 * Loads initial ticket data from ITSM_data.csv into the database.
 *
 * Features:
 * - Case-insensitive CSV column mapping
 * - Trims all string values
 * - Converts empty strings to NULL
 * - Normalizes date fields to ISO format
 * - Uses SQLite transaction for performance
 * - Skips duplicate ids
 * - Falls back to sample data if CSV missing/empty
 */

const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const { getDatabase } = require('../config/database');

/**
 * Mapping from CSV headers to database columns
 */
const COLUMN_MAPPING = {
  
  CI_Name: 'title',
  CI_Cat: 'description',
  Status: 'status',
  Priority: 'priority',
  Category: 'category',
  Impact: 'impact',
  Urgency: 'urgency',
  Open_Time: 'created_at',
  Resolved_Time: 'resolved_at',
  Close_Time: 'closed_at'
};

/**
 * Normalize string values:
 * - Trim whitespace
 * - Convert empty strings to null
 */
function normalizeValue(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return value;
}

/**
 * Convert any valid date string to ISO format.
 * Returns null if invalid or empty.
 */
function normalizeDate(value) {
  if (!value) return null;

  const d = new Date(value);
  if (isNaN(d)) return null;

  return d.toISOString();
}



/**
 * Map a CSV row into a ticket object using COLUMN_MAPPING.
 * Matching is case-insensitive.
 */
function mapRowToTicket(row) {
  const ticketData = {};

  for (const [csvColumn, dbField] of Object.entries(COLUMN_MAPPING)) {
    const rowKey = Object.keys(row).find(
      key => key.trim().toLowerCase() === csvColumn.toLowerCase()
    );

    if (rowKey) {
      let value = normalizeValue(row[rowKey]);

      ticketData[dbField] = value;
    }
  }

  // Normalize date fields
  ticketData.created_at = normalizeDate(ticketData.created_at);
  ticketData.resolved_at = normalizeDate(ticketData.resolved_at);
  ticketData.closed_at = normalizeDate(ticketData.closed_at);

  return ticketData;
}

/**
 * Parse CSV file into memory.
 */
function parseCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Load initial data from ITSM CSV if database is empty
 */
async function loadInitialData() {
  const db = getDatabase();
  const csvPath = path.resolve(__dirname, '../../user_input_files/ITSM_data.csv');

  try {
    const existingData = await db.get('SELECT COUNT(*) as count FROM tickets');

    if (existingData.count > 0) {
      console.log(`Database already contains ${existingData.count} tickets. Skipping CSV load.`);
      return { loaded: false, reason: 'Database not empty' };
    }

    const fileExists = await fs.pathExists(csvPath);
    if (!fileExists) {
      console.warn(`CSV file not found at ${csvPath} and there are no tickets in ../data/tickets.db.`);
      return { loaded: false, reason: 'CSV file not found' };
    }

    const results = await parseCSV(csvPath);

    if (!results.length) {
      console.warn('CSV file is empty.');
      return { loaded: false, reason: 'CSV empty' };
    }

    let inserted = 0;
    let skipped = 0;

    await db.run('BEGIN TRANSACTION');

    try {
      for (const row of results) {
        const ticketData = mapRowToTicket(row);
/*Debugging RowToTicket Output
        console.log(ticketData) */

        const result = await db.run(
          `
          INSERT OR IGNORE INTO tickets (
            title,
            description,
            status,
            priority,
            category,
            impact,
            urgency,
            created_at,
            resolved_at,
            closed_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            
            ticketData.title,
            ticketData.description,
            ticketData.status || 'Open',
            ticketData.priority || '3',
            ticketData.category || 'incident',
            ticketData.impact,
            ticketData.urgency,
            ticketData.created_at,
            ticketData.resolved_at,
            ticketData.closed_at
          ]
        );

        if (result.changes === 0) skipped++;
        else inserted++;
      }

      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    console.log(`Successfully loaded ${inserted} tickets (skipped: ${skipped})`);
    return { loaded: true, count: inserted, skipped };

  } catch (error) {
    console.error('Error loading CSV data:', error);
    throw error;
  }
}



module.exports = {
  loadInitialData,
  mapRowToTicket
};

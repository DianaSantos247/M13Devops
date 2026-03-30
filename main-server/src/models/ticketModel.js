/**
 * Ticket Model
 * 
 * Database operations for ticket management.
 * Uses ITSM schema with id as primary key.
 */

const { getDatabase } = require('../config/database');

/**
 * Get all tickets with optional filters
 * @param {object} filters - Query filters
 * @returns {Promise<Array>} Array of tickets
 */
async function getAllTickets(filters = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  // Status filter
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  // Priority filter
  if (filters.priority) {
    query += ' AND priority = ?';
    params.push(filters.priority);
  }

  // Category filter
  if (filters.category) {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  // Ticket ID filter
  if (filters.id) {
    query += ' AND id = ?';
    params.push(filters.id);
  }

  // Search filter (search in title and description)
  if (filters.search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  // Sorting
  const sortBy = filters.sortBy || 'created_at';
  const sortOrder = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const allowedSortFields = ['id', 'title', 'status', 'priority', 'category', 'created_at', 'updated_at'];
  
  if (allowedSortFields.includes(sortBy)) {
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
  }

  // Pagination
  const limit = Math.min(parseInt(filters.limit) || 100, 1000);
  const offset = parseInt(filters.offset) || 0;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const tickets = await db.all(query, params);
  
  // Get total count for pagination
  let countQuery = 'SELECT COUNT(*) as total FROM tickets WHERE 1=1';
  let countParams = [];
  
  if (filters.status) {
    countQuery += ' AND status = ?';
    countParams.push(filters.status);
  }
  if (filters.priority) {
    countQuery += ' AND priority = ?';
    countParams.push(filters.priority);
  }
  if (filters.category) {
    countQuery += ' AND category = ?';
    countParams.push(filters.category);
  }
  if (filters.id) {
    countQuery += ' AND id = ?';
    countParams.push(filters.id);
  }

  const { total } = await db.get(countQuery, countParams);

  return {
    data: tickets.map(ticket => formatTicket(ticket)),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + tickets.length < total
    }
  };
}

/**
 * Get ticket by id (primary key)
 * @param {string} ticketId - Ticket ID (e.g., 4)
 * @returns {Promise<object|null>} Ticket or null if not found
 */
async function getTicketById(ticketId) {
  const db = getDatabase();
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
  return ticket ? formatTicket(ticket) : null;
}

/**
 * Create a new ticket
 * @param {object} ticketData - Ticket data
 * @returns {Promise<object>} Created ticket
 */
async function createTicket(ticketData) {
  const db = getDatabase();
  
  const { id, title, description, priority, category, impact, urgency } = ticketData;
  
  // Generate id if not provided
  const result = await db.run(
    `INSERT INTO tickets (title, description, priority, category, impact, urgency, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'Open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ title || null, description || null, priority || '3', category || 'incident', impact || null, urgency || null]
  );
  const newTicketId = result.lastID;

  // Get the created ticket by its ID
  const createdTicket = await getTicketById(newTicketId);
  console.log('Ticket created', { id: newTicketId });
  
  return createdTicket;
}

/**
 * Update a ticket
 * @param {string} ticketId - Ticket ID
 * @param {object} updateData - Fields to update
 * @returns {Promise<object|null>} Updated ticket or null
 */
async function updateTicket(ticketId, updateData) {
  const db = getDatabase();
  
  // Check if ticket exists
  const existingTicket = await getTicketById(ticketId);
  if (!existingTicket) {
    return null;
  }

  // Build dynamic update query
  const allowedFields = ['title', 'description', 'status', 'priority', 'category', 'impact', 'urgency'];
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    return existingTicket;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(ticketId);

  await db.run(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  // Handle resolved_at/closed_at timestamps based on status changes
  if (updateData.status) {
    if (updateData.status === 'Closed' && !existingTicket.closed_at) {
      await db.run(
        'UPDATE tickets SET closed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [ticketId]
      );
    }
  }

  const updatedTicket = await getTicketById(ticketId);
  console.log('Ticket updated', { id: ticketId });
  
  return updatedTicket;
}

/**
 * Delete a ticket
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteTicket(ticketId) {
  const db = getDatabase();
  
  // Check if ticket exists
  const existingTicket = await getTicketById(ticketId);
  if (!existingTicket) {
    return false;
  }

  await db.run('DELETE FROM tickets WHERE id = ?', [ticketId]);
  console.log('Ticket deleted', { id: ticketId });
  
  return true;
}

/**
 * Get ticket statistics
 * @returns {Promise<object>} Statistics object
 */
async function getTicketStats() {
  const db = getDatabase();
  
  const total = await db.get('SELECT COUNT(*) as count FROM tickets');
  
  const byStatus = await db.all(`
    SELECT status, COUNT(*) as count
    FROM tickets
    GROUP BY status
  `);
  
  const byPriority = await db.all(`
    SELECT priority, COUNT(*) as count
    FROM tickets
    GROUP BY priority
  `);
  
  const byCategory = await db.all(`
    SELECT category, COUNT(*) as count
    FROM tickets
    GROUP BY category
  `);

  // Calculate percentages
  const totalCount = total.count || 1;
  
  return {
    total: total.count,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s.count])),
    byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p.count])),
    byCategory: Object.fromEntries(byCategory.map(c => [c.category, c.count])),
    percentages: {
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, ((s.count / totalCount) * 100).toFixed(1)])),
      byPriority: Object.fromEntries(byPriority.map(p => [p.priority, ((p.count / totalCount) * 100).toFixed(1)])),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category, ((c.count / totalCount) * 100).toFixed(1)]))
    }
  };
}

/**
 * Format ticket for API response
 * Applies conditional field visibility based on status
 * @param {object} ticket - Raw database ticket
 * @returns {object} Formatted ticket with conditional fields
 */
function formatTicket(ticket) {
  const formatted = {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    impact: ticket.impact,
    urgency: ticket.urgency,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at
  };

  // Only include resolved_at and closed_at in the response if they exist
  // This implements the requirement: closed_at should not appear if status is not Closed
  if (ticket.resolved_at) {
    formatted.resolved_at = ticket.resolved_at;
  }

  if (ticket.status === 'Closed' && ticket.closed_at) {
    formatted.closed_at = ticket.closed_at;
  }

  return formatted;
}

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketStats
};

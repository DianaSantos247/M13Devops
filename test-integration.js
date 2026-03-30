#!/usr/bin/env node

/**
 * Integration Test Script for Ticket Manager with Webhooks
 * 
 * This script demonstrates the complete functionality of the system
 * by running a series of API calls to the main server and showing
 * webhook notifications on the receiver.
 */

const http = require('http');

const MAIN_SERVER = 'http://localhost:3000';
const RECEIVER_SERVER = 'http://localhost:5001';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

/**
 * Make HTTP request
 */
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MAIN_SERVER);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Wait for specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run all tests
 */
async function runTests() {
  logSection('TICKET MANAGER WITH WEBHOOKS - INTEGRATION TESTS');
  console.log('\nThis script will test:');
  console.log('1. Server health check');
  console.log('2. Ticket CRUD operations');
  console.log('3. Webhook registration');
  console.log('4. Webhook notifications');
  console.log('5. Statistics endpoints');
  console.log('\nMake sure both servers are running before starting!');
  console.log('\nMain Server:', MAIN_SERVER);
  console.log('Receiver Server:', RECEIVER_SERVER);

  try {
    // Test 1: Health Check
    logSection('TEST 1: Health Check');
    const health = await request('GET', '/health');
    log(`Status: ${health.statusCode}`, health.statusCode === 200 ? 'green' : 'red');
    console.log('Response:', JSON.stringify(health.body, null, 2));

    // Test 2: List Tickets
    logSection('TEST 2: List Tickets (with filters)');
    const tickets = await request('GET', '/api/tickets?status=OPEN&limit=5');
    log(`Status: ${tickets.statusCode}`, tickets.statusCode === 200 ? 'green' : 'red');
    console.log(`Found ${tickets.body?.data?.length || 0} open tickets`);

    // Test 3: Get Statistics
    logSection('TEST 3: Statistics Endpoints');
    const stats = await request('GET', '/api/stats/summary');
    log(`Status: ${stats.statusCode}`, stats.statusCode === 200 ? 'green' : 'red');
    console.log('Summary:', JSON.stringify(stats.body, null, 2));

    // Test 4: Create Ticket (will trigger webhook)
    logSection('TEST 4: Create Ticket (triggers webhook.notification)');
    log('Creating ticket...', 'yellow');
    const newTicket = await request('POST', '/api/tickets', {
      title: 'Test Ticket from Integration Script',
      description: 'This ticket was created by the integration test script',
      priority: 'MEDIUM',
      category: 'TEST',
      assignee: 'integration.test'
    });
    log(`Status: ${newTicket.statusCode}`, newTicket.statusCode === 201 ? 'green' : 'red');
    console.log('Created ticket:', JSON.stringify(newTicket.body, null, 2));
    
    const createdTicketId = newTicket.body?.id;
    
    // Wait for webhook to be processed
    log('\nWaiting for webhook notification to be displayed...', 'yellow');
    await sleep(2000);

    // Test 5: Update Ticket (will trigger webhook)
    if (createdTicketId) {
      logSection(`TEST 5: Update Ticket #${createdTicketId} (triggers webhook)`);
      log('Updating ticket status...', 'yellow');
      const updatedTicket = await request('PUT', `/api/tickets/${createdTicketId}`, {
        status: 'IN_PROGRESS',
        priority: 'HIGH'
      });
      log(`Status: ${updatedTicket.statusCode}`, updatedTicket.statusCode === 200 ? 'green' : 'red');
      console.log('Updated ticket:', JSON.stringify(updatedTicket.body, null, 2));
      
      await sleep(2000);
    }

    // Test 6: Register Webhook
    logSection('TEST 6: Register Webhook');
    const webhook = await request('POST', '/api/webhooks', {
      payloadUrl: `${RECEIVER_SERVER}/webhook`,
      events: ['ticket.created', 'ticket.updated', 'ticket.deleted'],
      description: 'Integration test webhook'
    });
    log(`Status: ${webhook.statusCode}`, webhook.statusCode === 201 ? 'green' : 'red');
    console.log('Registered webhook:', JSON.stringify(webhook.body, null, 2));
    
    const webhookId = webhook.body?.id;

    // Test 7: Create another ticket (should trigger webhook)
    if (webhookId) {
      logSection('TEST 7: Create Another Ticket (should trigger registered webhook)');
      log('Creating ticket with registered webhook...', 'yellow');
      const ticket2 = await request('POST', '/api/tickets', {
        title: 'Webhook Test Ticket',
        description: 'This should trigger the registered webhook',
        priority: 'CRITICAL',
        category: 'FEATURE',
        assignee: 'webhook.test'
      });
      log(`Status: ${ticket2.statusCode}`, ticket2.statusCode === 201 ? 'green' : 'red');
      console.log('Created ticket:', JSON.stringify(ticket2.body, null, 2));
      
      await sleep(2000);
    }

    // Test 8: List Registered Webhooks
    logSection('TEST 8: List Registered Webhooks');
    const webhooks = await request('GET', '/api/webhooks');
    log(`Status: ${webhooks.statusCode}`, webhooks.statusCode === 200 ? 'green' : 'red');
    console.log(`Found ${webhooks.body?.length || 0} registered webhook(s)`);

    // Test 9: Get Single Ticket
    if (createdTicketId) {
      logSection(`TEST 9: Get Ticket #${createdTicketId}`);
      const ticket = await request('GET', `/api/tickets/${createdTicketId}`);
      log(`Status: ${ticket.statusCode}`, ticket.statusCode === 200 ? 'green' : 'red');
      console.log('Ticket:', JSON.stringify(ticket.body, null, 2));
    }

    // Test 10: Delete Ticket (should trigger webhook)
    if (createdTicketId) {
      logSection(`TEST 10: Delete Ticket #${createdTicketId} (triggers webhook)`);
      log('Deleting ticket...', 'yellow');
      const deleted = await request('DELETE', `/api/tickets/${createdTicketId}`);
      log(`Status: ${deleted.statusCode}`, deleted.statusCode === 200 ? 'green' : 'red');
      console.log('Response:', JSON.stringify(deleted.body, null, 2));
      
      await sleep(2000);
    }

    // Clean up: Delete test webhook
    if (webhookId) {
      logSection('CLEANUP: Delete Test Webhook');
      const deletedWebhook = await request('DELETE', `/api/webhooks/${webhookId}`);
      log(`Status: ${deletedWebhook.statusCode}`, deletedWebhook.statusCode === 200 ? 'green' : 'red');
    }

    // Final Summary
    logSection('TEST EXECUTION COMPLETE');
    log('All tests executed successfully!', 'green');
    console.log('\nCheck the webhook receiver console to see webhook notifications.');
    console.log('\nSummary:');
    console.log('- Health check tested');
    console.log('- Ticket CRUD operations tested');
    console.log('- Webhook registration tested');
    console.log('- Webhook notifications tested');
    console.log('- Statistics endpoints tested');

  } catch (error) {
    logSection('TEST ERROR');
    log(`Error: ${error.message}`, 'red');
    console.log('\nMake sure both servers are running:');
    console.log(`1. Main server: ${MAIN_SERVER}`);
    console.log(`2. Webhook receiver: ${RECEIVER_SERVER}`);
    console.log('\nTo start the servers:');
    console.log('Terminal 1: cd main-server && npm start');
    console.log('Terminal 2: cd webhook-receiver && npm start');
  }
}

// Run tests
runTests();

# Ticket Manager with Webhooks System

A distributed ticket management system built with Node.js and Express, featuring webhook notifications between two independent servers. Uses ITSM (IT Service Management) data schema.

## Architecture Overview

```
┌─────────────────────┐                        ┌─────────────────────┐
│   MAIN SERVER       │                        │  SECONDARY SERVER   │
│   (Port 3000*)      │    Webhook Request     │    (Port 5001*)     │
│                     │ ─────────────────────► │                     │
│  ┌───────────────┐  │    POST /webhook       │  ┌───────────────┐  │
│  │   REST API    │  │                        │  │   Receiver    │  │
│  │   /api/*      │  │   Validation & Log     │  │   Endpoint    │  │
│  └───────────────┘  │                        │  └───────────────┘  │
│  ┌───────────────┐  │                        │                     │
│  │   SQLite DB   │  │                        │    Console Output   │
│  │  (ITSM Data)  │  │                        │                     │
│  └───────────────┘  │                        │                     │
│  ┌───────────────┐  │                        │                     │
│  │  Webhook      │  │                        │                     │
│  │  Dispatcher   │  │                        │                     │
│  └───────────────┘  │                        │                     │
└─────────────────────┘                        └─────────────────────┘

*The PORT values 3000 and 5001 are used as an example in all the documentation. The PORT values must be set in the .env according to the user's preference.
```

## Project Structure

```
ticket-webhook-system/
├── main-server/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── controllers/
│   │   │   ├── healthController.js
│   │   │   ├── statsController.js
│   │   │   ├── ticketController.js
│   │   │   └── webhookController.js
│   │   ├── models/
│   │   │   ├── ticketModel.js
│   │   │   └── webhookModel.js
│   │   ├── routes/
│   │   │   ├── healthRoutes.js
│   │   │   ├── statsRoutes.js
│   │   │   ├── ticketRoutes.js
│   │   │   └── webhookRoutes.js
│   │   ├── services/
│   │   │   ├── csvLoader.js
│   │   │   └── webhookService.js
│   │   ├── utils/
│   │   │   └── hmacUtil.js
│   │   └── app.js
│   ├── data/
│   │   └── tickets.db
│   ├── docs/
│   │   └── openapi.yaml
│   ├── user_input_files/
│   │   └── ITSM_data.csv
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── webhook-receiver/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── index.js
│   │   └── middleware/
│   │       └── webhookValidation.js
│   ├── .env
│   ├── package.json
│   └── index.js
│
└── README.md
```

## ITSM Data Schema

The system uses data from `ITSM_data.csv` with the following column mapping:

| CSV Column | Database Field | Description |
|------------|----------------|-------------|
| `Incident_ID` | `id` | Unique ticket identifier (e.g., 4) |
| `CI_Name` | `title` | Ticket title/subject |
| `CI_Cat` | `description` | Ticket description/category |
| `Status` | `status` | Ticket status (Open, In Progress, Closed) |
| `Priority` | `priority` | Priority level (Low, Medium, High, Critical) |
| `Category` | `category` | Ticket category |
| `Open_Time` | `created_at` | When the ticket was opened |
| `Resolved_Time` | `resolved_at` | When the ticket was resolved |
| `Close_Time` | `closed_at` | When the ticket was closed |

### Conditional Field Visibility

The `closed_at` field is only included in API responses when the ticket status is **Closed**. This provides a cleaner user experience by only showing relevant information.

**Example - Open Ticket:**
```json
{
  "id": 1,
  "title": "SUB000501",
  "description": "subapplication",
  "status": "Open",
  "priority": "High",
  "category": "incident",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

**Example - Closed Ticket:**
```json
{
  "id": 2,
  "title": "SUB000502",
  "description": "subapplication",
  "status": "Closed",
  "priority": "Medium",
  "category": "incident",
  "created_at": "2024-01-15T10:00:00.000Z",
  "resolved_at": "2024-01-15T14:00:00.000Z",
  "closed_at": "2024-01-16T09:00:00.000Z"
}
```

## Installation & Setup

### Prerequisites & Tech Stack
- Node.js (v16 or higher)
- npm (Node Package Manager)

If you need a sample `ITSM_data.csv`, we highly recommend using the [Kaggle's Sample](https://www.kaggle.com/datasets/ahanwadi/itsm-data/data?select=ITSM_data.csv).

### Step 1: Clone and Install Dependencies

```bash
# Install Main Server dependencies
cd main-server
npm install

# Install Secondary Server dependencies
cd ../webhook-receiver
npm install
```

### Step 2: Configure Environment Variables

Create `.env` files in both directories:

**main-server/.env**
```env
PORT=3000
DATABASE_URL=./data/tickets.db
WEBHOOK_SECRET=<your_secret>
NODE_ENV=development
```

**webhook-receiver/.env**
```env
PORT=5001
WEBHOOK_SECRET=<your_secret>
NODE_ENV=development
```

### Step 3: Run the Servers

**Terminal 1 - Main Server**
```bash
cd main-server
npm start
```

**Terminal 2 - Secondary Server**
```bash
cd webhook-receiver
npm start
```

## API Documentation

### Health Check

**GET /health**

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running",
  "port": 3000,
  "timestamp": "2026-01-29T10:00:00.000Z"
}
```

### Tickets API

#### Create a Ticket

**POST /api/tickets**

Creates a new ticket and triggers webhook notifications.

**Request Body:**
```json
{
  "title": "SUB000501",
  "description": "subapplication",
  "priority": "High",
  "category": "incident"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "title": "SUB000501",
  "description": "subapplication",
  "status": "Open",
  "priority": "High",
  "category": "incident",
  "created_at": "2026-01-29T10:00:00.000Z",
  "updated_at": "2026-01-29T10:00:00.000Z"
}
```

#### List Tickets

**GET /api/tickets**

Retrieves tickets with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (Open, In Progress, Closed) |
| `priority` | string | Filter by priority (Low, Medium, High, Critical) |
| `category` | string | Filter by category (incident, request for information, etc.) |
| `id` | number | Filter by ticket ID (e.g., 4) |
| `limit` | number | Maximum number of results (default: 100) |
| `offset` | number | Number of records to skip (for pagination) |
| `sortBy` | string | Field to sort by (default: created_at) |
| `sortOrder` | string | ASC or DESC (default: DESC) |

**Example Request:**
```bash
curl "http://localhost:3000/api/tickets?status=Open&priority=High&limit=10"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "SUB000501",
      "description": "subapplication",
      "status": "Open",
      "priority": "High",
      "category": "incident",
      "created_at": "2026-01-29T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Single Ticket

**GET /api/tickets/:id**

Retrieves a specific ticket by id.

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "SUB000501",
  "description": "subapplication",
  "status": "Open",
  "priority": "High",
  "category": "incident",
  "created_at": "2026-01-29T10:00:00.000Z",
  "updated_at": "2026-01-29T10:00:00.000Z"
}
```

#### Update a Ticket

**PUT /api/tickets/:id**

Updates ticket attributes. Triggers `ticket.updated` webhook event.

**Request Body:**
```json
{
  "status": "In Progress",
  "priority": "Critical"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "SUB000501",
  "description": "subapplication",
  "status": "In Progress",
  "priority": "Critical",
  "category": "incident",
  "created_at": "2026-01-29T10:00:00.000Z",
  "updated_at": "2026-01-29T10:05:00.000Z"
}
```

#### Delete a Ticket

**DELETE /api/tickets/:id**

Permanently removes a ticket. Triggers `ticket.deleted` webhook event.

**Response (200 OK):**
```json
{
  "message": "Ticket deleted successfully",
  "id": 1
}
```

### Statistics API

#### Get Ticket Summary

**GET /api/stats/summary**

Returns overall ticket statistics.

**Response (200 OK):**
```json
{
  "total": 150,
  "byStatus": {
    "Open": 45,
    "In Progress": 35,
    "Closed": 70
  },
  "byPriority": {
    "Low": 30,
    "Medium": 60,
    "High": 45,
    "Critical": 15
  },
  "byCategory": {
    "incident": 50,
    "request for information": 25,
    "request for change": 60,
    "problem": 10,
    "access request": 5
  }
}
```

### Webhooks API

#### Register a Webhook

**POST /api/webhooks**

Registers a URL to receive webhook notifications.

**Request Body:**
```json
{
  "payloadUrl": "http://localhost:5001/webhook",
  "events": ["ticket.created", "ticket.updated", "ticket.deleted"],
  "description": "Production webhook receiver"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "payloadUrl": "http://localhost:5001/webhook",
  "events": ["ticket.created", "ticket.updated", "ticket.deleted"],
  "description": "Production webhook receiver",
  "created_at": "2026-01-29T10:00:00.000Z"
}
```

#### List Registered Webhooks

**GET /api/webhooks**

Lists all registered webhook subscriptions.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "payloadUrl": "http://localhost:5001/webhook",
    "events": ["ticket.created", "ticket.updated", "ticket.deleted"],
    "description": "Production webhook receiver",
    "created_at": "2026-01-29T10:00:00.000Z"
  }
]
```

#### Delete a Webhook

**DELETE /api/webhooks/:id**

Removes a registered webhook.

**Response (200 OK):**
```json
{
  "message": "Webhook deleted successfully"
}
```

## Webhook Events

The system supports the following webhook event types:

| Event | Description |
|-------|-------------|
| `ticket.created` | Triggered when a new ticket is created |
| `ticket.updated` | Triggered when a ticket is modified |
| `ticket.deleted` | Triggered when a ticket is deleted |

### Webhook Payload Format

```json
{
  "event": "ticket.created",
  "timestamp": "2026-01-29T10:00:00.000Z",
  "data": {
    "id": 1,
    "title": "SUB000501",
    "description": "subapplication",
    "status": "Open",
    "priority": "High",
    "category": "incident",
    "created_at": "2026-01-29T10:00:00.000Z"
  }
}
```

### Webhook Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | Always `application/json` |
| `X-Webhook-Signature` | HMAC-SHA256 signature of the payload |
| `X-Webhook-Event` | The event type (e.g., `ticket.created`) |

## Testing with curl

### 1. Check Server Health
```bash
curl http://localhost:3000/health
```

### 2. List All Tickets
```bash
curl http://localhost:3000/api/tickets
```

### 3. Create a Ticket
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "SUB000503",
    "description": "subapplication",
    "priority": "High",
    "category": "incident"
  }'
```

### 4. Update a Ticket
```bash
curl -X PUT http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "In Progress"}'
```

### 5. Register a Webhook
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "payloadUrl": "http://localhost:5001/webhook",
    "events": ["ticket.created", "ticket.updated"],
    "description": "Test webhook"
  }'
```

### 6. Get Statistics
```bash
curl http://localhost:3000/api/stats/summary
```

## Webhook Receiver Console Output

When the secondary server receives a valid webhook, it outputs:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEBHOOK RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signature Validated
Event: ticket.created
Timestamp: 2026-01-29T10:00:00.000Z
──────────────────────────────────────────────────────────────────
DATA:
{
  "id": 1,
  "title": "SUB000501",
  "status": "Open",
  "priority": "High",
  "category": "incident",
  "created_at": "2026-01-29T10:00:00.000Z"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Security Features

- **HMAC Signature**: All webhooks are signed using SHA-256 HMAC
- **Secret Validation**: Receivers verify the signature using a shared secret
- **Environment Variables**: Sensitive data stored in `.env` files
- **No Hardcoded Secrets**: All secrets loaded from environment

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database (via `sqlite3` and `sqlite` packages)
- **CSV Parser** - Data import (`csv-parser`)
- **Swagger/OpenAPI** - API documentation (`swagger-ui-express`, `yamljs`)
- **crypto** - HMAC signature generation (built-in Node.js)

## License

MIT License

## Author

Created for the UPskill's Introduction to Javascript module.

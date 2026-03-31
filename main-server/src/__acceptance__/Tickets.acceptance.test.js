/**
 * Testes de Aceitação — Ticket API
 *
 * Usa Supertest para simular pedidos HTTP reais (GET, POST, PUT, DELETE)
 * sem precisar de ter o servidor a correr manualmente.
 *
 * Usa base de dados SQLite em memória (:memory:) para:
 *  - Não contaminar a BD real (tickets.db)
 *  - Começar sempre com estado limpo
 *  - Desaparecer automaticamente no fim dos testes
 */

const request = require('supertest');

// ─── Mock da BD em memória ANTES de importar a app ───────────────────────────
jest.mock('../config/database', () => {
  const sqlite3 = require('sqlite3').verbose();
  const sqlite = require('sqlite');
  let db = null;

  async function initializeDatabase() {
    db = await sqlite.open({ filename: ':memory:', driver: sqlite3.Database });
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        closed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
    return db;
  }

  function getDatabase() {
    if (!db) throw new Error('Database not initialized');
    return db;
  }

  async function closeDatabase() {
    if (db) { await db.close(); db = null; }
  }

  return { initializeDatabase, getDatabase, closeDatabase };
});

jest.mock('../services/csvLoader', () => ({
  loadInitialData: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../services/webhookService', () => ({
  dispatchEvent: jest.fn().mockResolvedValue(true)
}));
// ─────────────────────────────────────────────────────────────────────────────

const app = require('../app');

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('deve responder com status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toBe('Server is running');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRUD completo de Tickets (fluxo real com BD em memória)
// ─────────────────────────────────────────────────────────────────────────────
describe('Tickets — fluxo completo com base de dados em memória', () => {

  let ticketId;

  describe('POST /api/tickets — criar ticket', () => {
    test('deve criar um ticket com sucesso e devolver 201', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          title: 'Ticket de teste de aceitação',
          description: 'Descrição do ticket de teste',
          priority: '2',
          category: 'incident'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Ticket de teste de aceitação');
      expect(res.body.status).toBe('Open');
      expect(res.body.priority).toBe('2');
      ticketId = res.body.id;
    });

    test('deve devolver 400 se o título estiver em falta', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({ description: 'Sem título', category: 'incident' });
      expect(res.statusCode).toBe(400);
    });

    test('deve devolver 400 se o título for uma string vazia', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({ title: '   ' });
      expect(res.statusCode).toBe(400);
    });

    test('deve usar valores por defeito quando priority e category não são enviados', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({ title: 'Ticket com defaults' });
      expect(res.statusCode).toBe(201);
      expect(res.body.priority).toBe('3');
      expect(res.body.category).toBe('incident');
    });
  });

  describe('GET /api/tickets — listar tickets', () => {
    test('deve devolver a lista de tickets com pelo menos 1 ticket', async () => {
      const res = await request(app).get('/api/tickets');
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('deve filtrar tickets por status Open', async () => {
      const res = await request(app).get('/api/tickets?status=Open');
      expect(res.statusCode).toBe(200);
      res.body.data.forEach(ticket => {
        expect(ticket.status).toBe('Open');
      });
    });

    test('deve rejeitar limit inválido com 400', async () => {
      const res = await request(app).get('/api/tickets?limit=abc');
      expect(res.statusCode).toBe(400);
    });

    test('deve respeitar o parâmetro limit', async () => {
      const res = await request(app).get('/api/tickets?limit=1');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/tickets/:id — obter ticket por ID', () => {
    test('deve devolver o ticket criado anteriormente', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(ticketId);
      expect(res.body.title).toBe('Ticket de teste de aceitação');
    });

    test('deve devolver 404 para um ID que não existe', async () => {
      const res = await request(app).get('/api/tickets/999999');
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('PUT /api/tickets/:id — atualizar ticket', () => {
    test('deve atualizar o título e devolver before/after', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .send({ title: 'Título atualizado', priority: '1' });

      expect(res.statusCode).toBe(200);
      expect(res.body.before).toBeDefined();
      expect(res.body.after).toBeDefined();
      expect(res.body.before.title).toBe('Ticket de teste de aceitação');
      expect(res.body.after.title).toBe('Título atualizado');
      expect(res.body.after.priority).toBe('1');
    });

    test('deve confirmar que a atualização foi persistida na BD', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe('Título atualizado');
    });

    test('deve devolver 404 ao atualizar um ticket que não existe', async () => {
      const res = await request(app)
        .put('/api/tickets/999999')
        .send({ title: 'Não existe' });
      expect(res.statusCode).toBe(404);
    });

    test('deve devolver 400 se o body estiver vazio', async () => {
      const res = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/tickets/:id — apagar ticket', () => {
    test('deve apagar o ticket e devolver mensagem de sucesso', async () => {
      const res = await request(app).delete(`/api/tickets/${ticketId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Ticket deleted successfully');
      expect(res.body.id).toBe(String(ticketId));
    });

    test('deve confirmar que o ticket foi apagado da BD', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);
      expect(res.statusCode).toBe(404);
    });

    test('deve devolver 404 ao apagar um ticket que não existe', async () => {
      const res = await request(app).delete('/api/tickets/999999');
      expect(res.statusCode).toBe(404);
    });
  });
});

describe('Rota inexistente', () => {
  test('deve devolver 404 para uma rota que não existe', async () => {
    const res = await request(app).get('/api/rota-que-nao-existe');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
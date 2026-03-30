/**
 * Testes unitários - Ticket Controller
 * Usa Jest + Supertest para testar os endpoints HTTP
 * sem precisar de base de dados real.
 */

// ─── Mocks obrigatórios ANTES de importar a app ───────────────────────────────
// Impede que a app tente ligar à BD ou carregar o CSV durante os testes
jest.mock('../config/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getDatabase: jest.fn()
}));

jest.mock('../services/csvLoader', () => ({
  loadInitialData: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../models/ticketModel');
jest.mock('../services/webhookService');
// ──────────────────────────────────────────────────────────────────────────────

const request = require('supertest');
const app = require('../app');
const ticketModel = require('../models/ticketModel');
const webhookService = require('../services/webhookService');

// Garantir que o webhook nunca falha nos testes
webhookService.dispatchEvent = jest.fn().mockResolvedValue(true);

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('deve devolver status ok com código 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toBe('Server is running');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/tickets', () => {
  test('deve devolver lista de tickets com código 200', async () => {
    ticketModel.getAllTickets = jest.fn().mockResolvedValue({
      data: [
        { id: 'T001', title: 'Ticket A', status: 'Open', priority: '2' },
        { id: 'T002', title: 'Ticket B', status: 'Closed', priority: '3' }
      ],
      total: 2,
      limit: 100,
      offset: 0
    });

    const res = await request(app).get('/api/tickets');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  test('deve devolver lista vazia quando não há tickets', async () => {
    ticketModel.getAllTickets = jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      limit: 100,
      offset: 0
    });

    const res = await request(app).get('/api/tickets');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('deve rejeitar limit inválido com 400', async () => {
    const res = await request(app).get('/api/tickets?limit=abc');
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tickets/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/tickets/:id', () => {
  test('deve devolver o ticket quando existe', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue({
      id: 'T001',
      title: 'Ticket de teste',
      status: 'Open',
      priority: '2',
      category: 'incident'
    });

    const res = await request(app).get('/api/tickets/T001');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('T001');
    expect(res.body.title).toBe('Ticket de teste');
  });

  test('deve devolver 404 quando o ticket não existe', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue(null);

    const res = await request(app).get('/api/tickets/NAO-EXISTE');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tickets
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/tickets', () => {
  test('deve criar ticket com sucesso e devolver 201', async () => {
    ticketModel.createTicket = jest.fn().mockResolvedValue({
      id: 'T999',
      title: 'Novo Ticket',
      status: 'Open',
      priority: '3',
      category: 'incident'
    });

    const res = await request(app)
      .post('/api/tickets')
      .send({ title: 'Novo Ticket', category: 'incident' });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBe('T999');
    expect(res.body.title).toBe('Novo Ticket');
    // Confirmar que o webhook foi disparado
    expect(webhookService.dispatchEvent).toHaveBeenCalledWith(
      'ticket.created',
      expect.objectContaining({ title: 'Novo Ticket' })
    );
  });

  test('deve devolver 400 se o título estiver em falta', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ category: 'incident' }); // sem title

    expect(res.statusCode).toBe(400);
  });

  test('deve devolver 400 se o título for uma string vazia', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ title: '   ' }); // só espaços

    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tickets/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/tickets/:id', () => {
  test('deve atualizar ticket e devolver before/after', async () => {
    const ticketAntes = { id: 'T001', title: 'Título antigo', status: 'Open' };
    const ticketDepois = { id: 'T001', title: 'Título novo', status: 'Open' };

    ticketModel.getTicketById = jest.fn().mockResolvedValue(ticketAntes);
    ticketModel.updateTicket = jest.fn().mockResolvedValue(ticketDepois);

    const res = await request(app)
      .put('/api/tickets/T001')
      .send({ title: 'Título novo' });

    expect(res.statusCode).toBe(200);
    expect(res.body.before.title).toBe('Título antigo');
    expect(res.body.after.title).toBe('Título novo');
  });

  test('deve devolver 404 se o ticket não existir', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tickets/NAO-EXISTE')
      .send({ title: 'Qualquer coisa' });

    expect(res.statusCode).toBe(404);
  });

  test('deve devolver 400 se não forem enviados campos para atualizar', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue({ id: 'T001' });

    const res = await request(app)
      .put('/api/tickets/T001')
      .send({}); // body vazio

    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tickets/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/tickets/:id', () => {
  test('deve apagar ticket com sucesso e devolver mensagem', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue({
      id: 'T001', title: 'Para apagar'
    });
    ticketModel.deleteTicket = jest.fn().mockResolvedValue(true);

    const res = await request(app).delete('/api/tickets/T001');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Ticket deleted successfully');
    expect(res.body.id).toBe('T001');
    expect(webhookService.dispatchEvent).toHaveBeenCalledWith(
      'ticket.deleted',
      expect.objectContaining({ id: 'T001' })
    );
  });

  test('deve devolver 404 se o ticket não existir', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue(null);

    const res = await request(app).delete('/api/tickets/NAO-EXISTE');
    expect(res.statusCode).toBe(404);
  });

  test('deve devolver 500 se o delete falhar na BD', async () => {
    ticketModel.getTicketById = jest.fn().mockResolvedValue({ id: 'T001' });
    ticketModel.deleteTicket = jest.fn().mockResolvedValue(false); // simula falha

    const res = await request(app).delete('/api/tickets/T001');
    expect(res.statusCode).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rota inexistente
// ─────────────────────────────────────────────────────────────────────────────
describe('Rota inexistente', () => {
  test('deve devolver 404 para uma rota que não existe', async () => {
    const res = await request(app).get('/api/rota-que-nao-existe');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
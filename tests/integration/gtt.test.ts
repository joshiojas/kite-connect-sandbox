import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('GTT Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  beforeEach(() => {
    app.db.exec("DELETE FROM gtt_orders");
    app.db.exec("DELETE FROM portfolios");
  });

  it('should create a GTT trigger', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/gtt/triggers',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'single',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger_values: [1400], last_price: 1500, instrument_token: 408065 }),
        orders: JSON.stringify([{ exchange: 'NSE', tradingsymbol: 'INFY', transaction_type: 'BUY', quantity: 10, order_type: 'LIMIT', product: 'CNC', price: 1400 }]),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data.trigger_id).toBeDefined();
  });

  it('should list GTT triggers', async () => {
    await app.inject({
      method: 'POST',
      url: '/gtt/triggers',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'single',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger_values: [1400], last_price: 1500 }),
        orders: JSON.stringify([]),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/gtt/triggers',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
  });

  it('should get a single GTT trigger', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/gtt/triggers',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'single',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger_values: [1400], last_price: 1500 }),
        orders: JSON.stringify([]),
      },
    });

    const triggerId = JSON.parse(createResponse.body).data.trigger_id;

    const response = await app.inject({
      method: 'GET',
      url: `/gtt/triggers/${triggerId}`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBe(triggerId);
    expect(body.data.type).toBe('single');
    expect(body.data.status).toBe('active');
  });

  it('should delete a GTT trigger', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/gtt/triggers',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'single',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger_values: [1400], last_price: 1500 }),
        orders: JSON.stringify([]),
      },
    });

    const triggerId = JSON.parse(createResponse.body).data.trigger_id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/gtt/triggers/${triggerId}`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);

    // Verify status changed
    const getResponse = await app.inject({
      method: 'GET',
      url: `/gtt/triggers/${triggerId}`,
      headers: { authorization: AUTH_HEADER },
    });
    const body = JSON.parse(getResponse.body);
    expect(body.data.status).toBe('deleted');
  });
});

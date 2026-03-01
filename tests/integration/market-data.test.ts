import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Market Data Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  it('should proxy GET /quote/ltp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/quote/ltp?i=NSE:INFY',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data['NSE:INFY']).toBeDefined();
    expect(body.data['NSE:INFY'].last_price).toBe(1500);
  });

  it('should proxy GET /quote', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/quote?i=NSE:INFY',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data['NSE:INFY']).toBeDefined();
    expect(body.data['NSE:INFY'].last_price).toBe(1500);
    expect(body.data['NSE:INFY'].ohlc).toBeDefined();
  });

  it('should proxy GET /quote/ohlc', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/quote/ohlc?i=NSE:INFY',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data['NSE:INFY'].ohlc).toBeDefined();
  });

  it('should proxy GET /instruments with CSV content-type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/instruments',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('instrument_token');
    expect(response.body).toContain('INFY');
  });

  it('should proxy GET /instruments/:exchange', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/instruments/NSE',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('INFY');
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Margins Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  beforeEach(() => {
    app.db.exec("DELETE FROM portfolios");
  });

  it('should return sandbox margins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data.equity).toBeDefined();
    expect(body.data.commodity).toBeDefined();
    expect(body.data.equity.available.cash).toBe(1000000);
  });

  it('should return segment margins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/user/margins/equity',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data.available).toBeDefined();
    expect(body.data.available.cash).toBe(1000000);
  });

  it('should reflect reduced cash after order', async () => {
    // Place a buy order
    await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: '10',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });

    const body = JSON.parse(response.body);
    // Cash should be less than initial capital
    expect(body.data.equity.available.cash).toBeLessThan(1000000);
  });
});

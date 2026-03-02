import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Portfolio Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  beforeEach(() => {
    app.db.exec("DELETE FROM order_history");
    app.db.exec("DELETE FROM trades");
    app.db.exec("DELETE FROM orders");
    app.db.exec("DELETE FROM positions");
    app.db.exec("DELETE FROM holdings");
    app.db.exec("DELETE FROM portfolios");
  });

  it('should return empty holdings initially', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data).toEqual([]);
  });

  it('should return holdings after CNC buy', async () => {
    // Place BUY order
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
      url: '/portfolio/holdings',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].tradingsymbol).toBe('INFY');
    expect(body.data[0].quantity).toBe(10);
  });

  it('should return positions after intraday trade', async () => {
    await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'MIS',
        quantity: '10',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/portfolio/positions',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.net.length).toBe(1);
    expect(body.data.net[0].quantity).toBe(10);
    expect(body.data.net[0].product).toBe('MIS');
  });

  it('should return empty auctions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings/auctions',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
  });

  it('should authorise holdings (no-op)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/portfolio/holdings/authorise',
      headers: { authorization: AUTH_HEADER },
      payload: { isin: 'INE009A01021' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
  });

  it('should return 403 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings',
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error_type).toBe('TokenException');
  });
});

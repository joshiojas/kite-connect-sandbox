import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Orders Integration', () => {
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

  it('should place a MARKET BUY order', async () => {
    const response = await app.inject({
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

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.data.order_id).toBeDefined();
  });

  it('should return 400 for missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        // missing tradingsymbol, etc.
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('error');
    expect(body.error_type).toBe('InputException');
  });

  it('should get all orders', async () => {
    // Place an order first
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
        quantity: '1',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
  });

  it('should get order history', async () => {
    const placeResponse = await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: '1',
      },
    });

    const orderId = JSON.parse(placeResponse.body).data.order_id;

    const response = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(1);
  });

  it('should get trades for an order', async () => {
    const placeResponse = await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: '5',
      },
    });

    const orderId = JSON.parse(placeResponse.body).data.order_id;

    const response = await app.inject({
      method: 'GET',
      url: `/orders/${orderId}/trades`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].quantity).toBe(5);
  });

  it('should get all trades', async () => {
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
        quantity: '1',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/trades',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
  });

  it('should cancel an AMO order', async () => {
    const placeResponse = await app.inject({
      method: 'POST',
      url: '/orders/amo',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: '1',
        price: '1400',
      },
    });

    const orderId = JSON.parse(placeResponse.body).data.order_id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/orders/amo/${orderId}`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.order_id).toBe(orderId);
  });

  it('should modify an AMO order', async () => {
    const placeResponse = await app.inject({
      method: 'POST',
      url: '/orders/amo',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: '5',
        price: '1400',
      },
    });

    const orderId = JSON.parse(placeResponse.body).data.order_id;

    const response = await app.inject({
      method: 'PUT',
      url: `/orders/amo/${orderId}`,
      headers: { authorization: AUTH_HEADER },
      payload: { price: '1450' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should return X-Kite-Sandbox header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.headers['x-kite-sandbox']).toBe('true');
  });
});

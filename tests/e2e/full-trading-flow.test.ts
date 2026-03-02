import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('E2E: Full Trading Flow', () => {
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

  it('should complete a full buy → verify → sell → verify flow', async () => {
    // 1. Verify initial capital via GET /user/margins
    const marginsResponse1 = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });
    expect(marginsResponse1.statusCode).toBe(200);
    const margins1 = JSON.parse(marginsResponse1.body);
    expect(margins1.data.equity.available.cash).toBe(1000000);

    // 2. GET /quote/ltp — get current price
    const ltpResponse = await app.inject({
      method: 'GET',
      url: '/quote/ltp?i=NSE:INFY',
      headers: { authorization: AUTH_HEADER },
    });
    expect(ltpResponse.statusCode).toBe(200);
    const ltp = JSON.parse(ltpResponse.body);
    const price = ltp.data['NSE:INFY'].last_price;
    expect(price).toBe(1500);

    // 3. POST /orders/regular — BUY 10 INFY CNC at MARKET
    const buyResponse = await app.inject({
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
    expect(buyResponse.statusCode).toBe(200);
    const buyResult = JSON.parse(buyResponse.body);
    const buyOrderId = buyResult.data.order_id;

    // 4. GET /orders — verify order is COMPLETE
    const ordersResponse = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: AUTH_HEADER },
    });
    const orders = JSON.parse(ordersResponse.body).data;
    expect(orders.length).toBe(1);
    expect(orders[0].status).toBe('COMPLETE');
    expect(orders[0].filled_quantity).toBe(10);

    // 5. GET /trades — verify trade exists
    const tradesResponse = await app.inject({
      method: 'GET',
      url: '/trades',
      headers: { authorization: AUTH_HEADER },
    });
    const trades = JSON.parse(tradesResponse.body).data;
    expect(trades.length).toBe(1);
    expect(trades[0].tradingsymbol).toBe('INFY');
    expect(trades[0].quantity).toBe(10);

    // 6. GET /portfolio/holdings — verify 10 INFY in holdings
    const holdingsResponse = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings',
      headers: { authorization: AUTH_HEADER },
    });
    const holdings = JSON.parse(holdingsResponse.body).data;
    expect(holdings.length).toBe(1);
    expect(holdings[0].tradingsymbol).toBe('INFY');
    expect(holdings[0].quantity).toBe(10);

    // 7. GET /user/margins — verify cash reduced by (price × 10)
    const marginsResponse2 = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });
    const margins2 = JSON.parse(marginsResponse2.body);
    const expectedCash = 1000000 - (price * 10);
    expect(margins2.data.equity.available.cash).toBe(expectedCash);

    // 8. POST /orders/regular — SELL 5 INFY CNC at MARKET
    const sellResponse = await app.inject({
      method: 'POST',
      url: '/orders/regular',
      headers: { authorization: AUTH_HEADER },
      payload: {
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'SELL',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: '5',
      },
    });
    expect(sellResponse.statusCode).toBe(200);

    // 9. GET /portfolio/holdings — verify 5 INFY remaining
    const holdingsResponse2 = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings',
      headers: { authorization: AUTH_HEADER },
    });
    const holdings2 = JSON.parse(holdingsResponse2.body).data;
    expect(holdings2[0].quantity).toBe(5);

    // 10. GET /portfolio/positions — verify position tracking
    const positionsResponse = await app.inject({
      method: 'GET',
      url: '/portfolio/positions',
      headers: { authorization: AUTH_HEADER },
    });
    const positions = JSON.parse(positionsResponse.body).data;
    expect(positions.net.length).toBeGreaterThan(0);

    // 11. Full margin accounting reconciliation
    const marginsResponse3 = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });
    const margins3 = JSON.parse(marginsResponse3.body);
    // Cash = initial - (10 * price) + (5 * price) = initial - (5 * price)
    const finalExpectedCash = 1000000 - (5 * price);
    expect(margins3.data.equity.available.cash).toBe(finalExpectedCash);
  });

  it('should handle sandbox reset', async () => {
    // Place an order to create some state
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

    // Reset
    const resetResponse = await app.inject({
      method: 'POST',
      url: '/sandbox/reset?api_key=test_api_key',
    });
    expect(resetResponse.statusCode).toBe(200);

    // Verify cash is reset
    const marginsResponse = await app.inject({
      method: 'GET',
      url: '/user/margins',
      headers: { authorization: AUTH_HEADER },
    });
    const margins = JSON.parse(marginsResponse.body);
    expect(margins.data.equity.available.cash).toBe(1000000);

    // Verify holdings cleared
    const holdingsResponse = await app.inject({
      method: 'GET',
      url: '/portfolio/holdings',
      headers: { authorization: AUTH_HEADER },
    });
    expect(JSON.parse(holdingsResponse.body).data.length).toBe(0);
  });
});

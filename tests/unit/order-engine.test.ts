import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { OrderEngine, OrderError } from '../../src/portfolio/order-engine.js';
import { startMockKiteServer, stopMockKiteServer } from '../helpers/mock-kite-server.js';
import { createTestApp, AUTH_HEADER, API_KEY } from '../setup.js';

describe('OrderEngine', () => {
  let app: FastifyInstance;
  let engine: OrderEngine;

  beforeAll(async () => {
    await startMockKiteServer();
    app = await createTestApp();
    engine = new OrderEngine(app.db, app.config, app);
  });

  afterAll(async () => {
    await app.close();
    await stopMockKiteServer();
  });

  beforeEach(() => {
    // Clean up orders and trades
    app.db.exec("DELETE FROM order_history");
    app.db.exec("DELETE FROM trades");
    app.db.exec("DELETE FROM orders");
    app.db.exec("DELETE FROM positions");
    app.db.exec("DELETE FROM holdings");
    app.db.exec("DELETE FROM portfolios");
  });

  describe('placeOrder', () => {
    it('should place a MARKET BUY order and fill immediately', async () => {
      const result = await engine.placeOrder(API_KEY, {
        variety: 'regular',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: 10,
      }, AUTH_HEADER);

      expect(result.order_id).toBeDefined();
      expect(result.order_id).toMatch(/^\d{15}$/);

      const orders = engine.getOrders(API_KEY);
      expect(orders.length).toBe(1);
      expect(orders[0]!.status).toBe('COMPLETE');
      expect(orders[0]!.filled_quantity).toBe(10);
    });

    it('should place a LIMIT BUY order and fill when autoFillLimitOrders is true', async () => {
      const result = await engine.placeOrder(API_KEY, {
        variety: 'regular',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: 5,
        price: 1450,
      }, AUTH_HEADER);

      expect(result.order_id).toBeDefined();
      const orders = engine.getOrders(API_KEY);
      expect(orders[0]!.status).toBe('COMPLETE');
    });

    it('should reject order with insufficient funds', async () => {
      await expect(
        engine.placeOrder(API_KEY, {
          variety: 'regular',
          exchange: 'NSE',
          tradingsymbol: 'INFY',
          transaction_type: 'BUY',
          order_type: 'LIMIT',
          product: 'CNC',
          quantity: 10000,
          price: 1500,
        }, AUTH_HEADER),
      ).rejects.toThrow(OrderError);
    });

    it('should reject SELL without holdings', async () => {
      await expect(
        engine.placeOrder(API_KEY, {
          variety: 'regular',
          exchange: 'NSE',
          tradingsymbol: 'INFY',
          transaction_type: 'SELL',
          order_type: 'MARKET',
          product: 'CNC',
          quantity: 10,
        }, AUTH_HEADER),
      ).rejects.toThrow(OrderError);
    });

    it('should create trade on fill', async () => {
      await engine.placeOrder(API_KEY, {
        variety: 'regular',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: 10,
      }, AUTH_HEADER);

      const trades = engine.getAllTrades(API_KEY);
      expect(trades.length).toBe(1);
      expect(trades[0]!.quantity).toBe(10);
      expect(trades[0]!.tradingsymbol).toBe('INFY');
    });

    it('should place AMO order with AMO REQ RECEIVED status', async () => {
      const result = await engine.placeOrder(API_KEY, {
        variety: 'amo',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: 1,
        price: 1400,
      }, AUTH_HEADER);

      const orders = engine.getOrders(API_KEY);
      expect(orders[0]!.status).toBe('AMO REQ RECEIVED');
    });

    it('should reject order with missing required parameters', async () => {
      await expect(
        engine.placeOrder(API_KEY, {
          variety: 'regular',
          exchange: '',
          tradingsymbol: '',
          transaction_type: 'BUY',
          order_type: 'MARKET',
          product: 'CNC',
          quantity: 0,
        }, AUTH_HEADER),
      ).rejects.toThrow(OrderError);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an OPEN order', async () => {
      // Place an AMO order (stays open)
      const { order_id } = await engine.placeOrder(API_KEY, {
        variety: 'amo',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: 1,
        price: 1400,
      }, AUTH_HEADER);

      const result = engine.cancelOrder(API_KEY, 'amo', order_id);
      expect(result.order_id).toBe(order_id);

      const orders = engine.getOrders(API_KEY);
      expect(orders[0]!.status).toBe('CANCELLED');
    });

    it('should not cancel a COMPLETE order', async () => {
      const { order_id } = await engine.placeOrder(API_KEY, {
        variety: 'regular',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: 1,
      }, AUTH_HEADER);

      expect(() => engine.cancelOrder(API_KEY, 'regular', order_id)).toThrow(OrderError);
    });
  });

  describe('modifyOrder', () => {
    it('should modify a pending order', async () => {
      const { order_id } = await engine.placeOrder(API_KEY, {
        variety: 'amo',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product: 'CNC',
        quantity: 5,
        price: 1400,
      }, AUTH_HEADER);

      const result = engine.modifyOrder(API_KEY, 'amo', order_id, {
        price: 1450,
        quantity: 10,
      });
      expect(result.order_id).toBe(order_id);
    });

    it('should not modify a non-existent order', () => {
      expect(() => engine.modifyOrder(API_KEY, 'regular', 'nonexistent', { price: 100 })).toThrow(OrderError);
    });
  });

  describe('getOrderHistory', () => {
    it('should record status transitions', async () => {
      const { order_id } = await engine.placeOrder(API_KEY, {
        variety: 'regular',
        exchange: 'NSE',
        tradingsymbol: 'INFY',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
        quantity: 1,
      }, AUTH_HEADER);

      const history = engine.getOrderHistory(API_KEY, order_id);
      expect(history.length).toBeGreaterThan(1);
      // Should have PUT ORDER REQ RECEIVED → OPEN PENDING → OPEN → COMPLETE
    });
  });
});

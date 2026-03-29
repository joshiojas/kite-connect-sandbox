import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server.js';
import { startMockKiteServer, stopMockKiteServer, getMockServerUrl } from '../helpers/mock-kite-server.js';
import { getProxyTestConfig, AUTH_HEADER } from '../setup.js';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Proxy mode', () => {
  let app: FastifyInstance;
  let logDir: string;
  let logPath: string;

  beforeAll(async () => {
    await startMockKiteServer();
  });

  afterAll(async () => {
    await stopMockKiteServer();
  });

  beforeEach(async () => {
    logDir = join(tmpdir(), `kite-proxy-test-${Date.now()}`);
    logPath = join(logDir, 'proxy-test.log');
    mkdirSync(logDir, { recursive: true });

    const config = getProxyTestConfig(logPath);
    config.upstream.baseUrl = getMockServerUrl();
    app = await buildApp(config);
    await app.ready();
  });

  afterEach(async () => {
    if (app) await app.close();
    try {
      if (existsSync(logPath)) unlinkSync(logPath);
    } catch { /* ignore */ }
  });

  describe('Order forwarding', () => {
    it('forwards POST /orders/regular to upstream and returns response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/regular',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=INFY&exchange=NSE&transaction_type=BUY&order_type=LIMIT&quantity=10&price=1500&product=CNC',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data.order_id).toBe('mock_order_123');
    });

    it('forwards PUT /orders/regular/:order_id to upstream', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/orders/regular/12345',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'quantity=20&price=1510',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data.order_id).toBe('12345');
    });

    it('forwards DELETE /orders/regular/:order_id to upstream', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/orders/regular/12345',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
    });

    it('forwards GET /orders to upstream', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data).toEqual([]);
    });

    it('forwards GET /trades to upstream', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/trades',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Portfolio forwarding', () => {
    it('forwards GET /portfolio/holdings to upstream', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/portfolio/holdings',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
    });

    it('forwards GET /portfolio/positions to upstream', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/portfolio/positions',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
    });

    it('forwards GET /user/margins to upstream', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/user/margins',
        headers: { authorization: AUTH_HEADER },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
    });
  });

  describe('Error passthrough', () => {
    it('passes through 4xx error responses unchanged', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/error_test',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=INFY&exchange=NSE&transaction_type=BUY&order_type=MARKET&quantity=10&product=CNC',
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
      expect(body.message).toBe('Insufficient funds');
      expect(body.error_type).toBe('MarginException');
    });
  });

  describe('Market protection injection', () => {
    it('injects market_protection=-1 for MARKET orders', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/regular',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=NIFTY&exchange=NFO&transaction_type=BUY&order_type=MARKET&quantity=75&product=NRML',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // The mock server echoes the body — verify market_protection was injected
      expect(body._echo.market_protection).toBe('-1');
    });

    it('does NOT inject for LIMIT orders', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders/regular',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=INFY&exchange=NSE&transaction_type=BUY&order_type=LIMIT&quantity=10&price=1500&product=CNC',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body._echo.market_protection).toBeUndefined();
    });
  });

  describe('Health endpoint', () => {
    it('returns mode=proxy in health check', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.mode).toBe('proxy');
      expect(body.data.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(body.data.upstream).toBeDefined();
      expect(body.data.upstream.reachable).toBe(true);
    });
  });

  describe('File logging', () => {
    it('writes ORDER_FORWARDED log record for order forward', async () => {
      await app.inject({
        method: 'POST',
        url: '/orders/regular',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=INFY&exchange=NSE&transaction_type=BUY&order_type=LIMIT&quantity=10&price=1500&product=CNC',
      });

      // Give the write stream time to flush
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(existsSync(logPath)).toBe(true);
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      // Find the ORDER_FORWARDED record
      const orderLog = lines
        .map((l) => JSON.parse(l))
        .find((r: { message: string }) => r.message === 'ORDER_FORWARDED');

      expect(orderLog).toBeDefined();
      expect(orderLog.service).toBe('KiteProxy');
      expect(orderLog.level).toBe('info');
      expect(orderLog.data.method).toBe('POST');
      expect(orderLog.data.path).toBe('/orders/regular');
      expect(orderLog.data.upstream_status).toBe(200);
      expect(orderLog.data.upstream_order_id).toBe('mock_order_123');
      expect(orderLog.data.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('writes MARKET_PROTECTION_INJECTED and ORDER_FORWARDED for MARKET order', async () => {
      await app.inject({
        method: 'POST',
        url: '/orders/regular',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=NIFTY&exchange=NFO&transaction_type=BUY&order_type=MARKET&quantity=75&product=NRML',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const content = readFileSync(logPath, 'utf-8');
      const records = content.trim().split('\n').map((l) => JSON.parse(l));

      const mpLog = records.find((r: { message: string }) => r.message === 'MARKET_PROTECTION_INJECTED');
      expect(mpLog).toBeDefined();
      expect(mpLog.data.order_type).toBe('MARKET');

      const orderLog = records.find((r: { message: string }) => r.message === 'ORDER_FORWARDED');
      expect(orderLog).toBeDefined();
      expect(orderLog.data.market_protection_injected).toBe(true);
    });

    it('writes ORDER_REJECTED for upstream 4xx', async () => {
      await app.inject({
        method: 'POST',
        url: '/orders/error_test',
        headers: { authorization: AUTH_HEADER, 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'tradingsymbol=INFY&exchange=NSE&transaction_type=BUY&order_type=MARKET&quantity=10&product=CNC',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const content = readFileSync(logPath, 'utf-8');
      const records = content.trim().split('\n').map((l) => JSON.parse(l));

      // Find ORDER_REJECTED (skip MARKET_PROTECTION_INJECTED)
      const rejectLog = records.find((r: { message: string }) => r.message === 'ORDER_REJECTED');
      expect(rejectLog).toBeDefined();
      expect(rejectLog.level).toBe('warn');
      expect(rejectLog.data.upstream_status).toBe(400);
    });
  });
});

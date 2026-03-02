import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Alerts Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  beforeEach(() => {
    app.db.exec("DELETE FROM alerts");
    app.db.exec("DELETE FROM portfolios");
  });

  it('should create an alert', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/alerts',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'simple',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger: 1500 }),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.uuid).toBeDefined();
  });

  it('should list alerts', async () => {
    await app.inject({
      method: 'POST',
      url: '/alerts',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'simple',
        condition: JSON.stringify({ exchange: 'NSE', tradingsymbol: 'INFY', trigger: 1500 }),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/alerts',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
  });

  it('should get alert history (empty)', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/alerts',
      headers: { authorization: AUTH_HEADER },
      payload: {
        type: 'simple',
        condition: JSON.stringify({ trigger: 1500 }),
      },
    });

    const uuid = JSON.parse(createResponse.body).data.uuid;

    const response = await app.inject({
      method: 'GET',
      url: `/alerts/${uuid}/history`,
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
  });
});

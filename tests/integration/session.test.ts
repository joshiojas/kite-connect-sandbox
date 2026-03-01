import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite, AUTH_HEADER } from '../setup.js';

describe('Session Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  it('should return 403 for request without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders',
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('error');
    expect(body.error_type).toBe('TokenException');
  });

  it('should return 403 for malformed auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: 'invalid_format' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('should accept valid auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { authorization: AUTH_HEADER },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should allow health check without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.status).toBe('ok');
  });
});

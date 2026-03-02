import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setupTestSuite, teardownTestSuite } from '../setup.js';

describe('WebSocket Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const suite = await setupTestSuite();
    app = suite.app;
  });

  afterAll(async () => {
    await teardownTestSuite();
  });

  it('should have websocket route registered', async () => {
    // Test that the WebSocket route exists by checking with a regular GET request
    // (which won't upgrade but will show the route is registered)
    const response = await app.inject({
      method: 'GET',
      url: '/ws?api_key=test&access_token=test',
    });
    // WebSocket routes may return various codes when accessed without upgrade
    // The important thing is they don't return 404
    expect(response.statusCode).not.toBe(404);
  });
});

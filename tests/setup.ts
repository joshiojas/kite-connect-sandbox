import { beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';
import { startMockKiteServer, stopMockKiteServer, getMockServerUrl } from './helpers/mock-kite-server.js';
import type { AppConfig } from '../src/types/config.js';

let app: FastifyInstance;
let mockUrl: string;

export function getTestConfig(): AppConfig {
  return {
    server: {
      port: 0,
      host: '127.0.0.1',
      logLevel: 'silent',
    },
    sandbox: {
      initialCapital: 1000000,
      currency: 'INR',
      defaultSegments: ['equity', 'commodity'],
      persistence: 'memory',
      dbPath: ':memory:',
      resetPortfolioOnRestart: false,
    },
    upstream: {
      baseUrl: getMockServerUrl(),
      wsUrl: 'ws://127.0.0.1:9999',
      timeout: 5000,
      retries: 0,
    },
    orderEngine: {
      defaultSlippage: 0.0,
      slippageModel: 'none',
      fixedSlippage: 0,
      simulatePartialFills: false,
      marketOrderFillDelay: 0,
      autoFillLimitOrders: true,
      rejectAfterMarketHours: false,
    },
    rateLimits: {
      enabled: false,
      quote: 100,
      historical: 100,
      orders: 100,
      default: 100,
      ordersPerMinute: 10000,
      ordersPerDay: 100000,
    },
  };
}

export async function createTestApp(): Promise<FastifyInstance> {
  const config = getTestConfig();
  const testApp = await buildApp(config);
  await testApp.ready();
  return testApp;
}

export function getApp(): FastifyInstance {
  return app;
}

export const AUTH_HEADER = 'token test_api_key:test_access_token';
export const API_KEY = 'test_api_key';

export async function setupTestSuite(): Promise<{ app: FastifyInstance; mockUrl: string }> {
  const mock = await startMockKiteServer();
  mockUrl = mock.url;
  app = await createTestApp();
  return { app, mockUrl };
}

export async function teardownTestSuite(): Promise<void> {
  if (app) await app.close();
  await stopMockKiteServer();
}

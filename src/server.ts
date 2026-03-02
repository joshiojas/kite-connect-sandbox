import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from './types/config.js';
import { databasePlugin } from './db/database.js';
import { authPlugin } from './middleware/auth.js';
import { requestLoggerPlugin } from './middleware/request-logger.js';
import { rateLimiterPlugin } from './middleware/rate-limiter.js';
import { successResponse } from './utils/response.js';

// Route plugins
import { sessionRoutes } from './routes/session.js';
import { userRoutes } from './routes/user.js';
import { ordersRoutes } from './routes/orders.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { marketDataRoutes } from './routes/market-data.js';
import { gttRoutes } from './routes/gtt.js';
import { alertsRoutes } from './routes/alerts.js';
import { mutualFundsRoutes } from './routes/mutual-funds.js';
import { marginsRoutes } from './routes/margins.js';
import { basketRoutes } from './routes/basket.js';
import { websocketRoutes } from './routes/websocket.js';
import { sandboxAdminRoutes } from './routes/sandbox-admin.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
    },
  });

  // Register form body parser for application/x-www-form-urlencoded
  await app.register(formbody);

  // Decorate with config
  app.decorate('config', config);

  // Add X-Kite-Sandbox header to all responses
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Kite-Sandbox', 'true');
    return payload;
  });

  // Register core plugins
  await app.register(databasePlugin);
  await app.register(authPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(rateLimiterPlugin);

  // Health check
  app.get('/health', async () => {
    return successResponse({ status: 'ok' });
  });

  // Register route plugins
  await app.register(sessionRoutes);
  await app.register(userRoutes);
  await app.register(ordersRoutes);
  await app.register(portfolioRoutes);
  await app.register(marketDataRoutes);
  await app.register(gttRoutes);
  await app.register(alertsRoutes);
  await app.register(mutualFundsRoutes);
  await app.register(marginsRoutes);
  await app.register(basketRoutes);
  await app.register(websocketRoutes);
  await app.register(sandboxAdminRoutes);

  return app;
}

// Config plugin for dependency resolution
export const configPlugin = fp(
  async (fastify: FastifyInstance, opts: { config: AppConfig }) => {
    fastify.decorate('config', opts.config);
  },
  { name: 'config' },
);

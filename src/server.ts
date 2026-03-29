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
import { initFileLogger, logRecord, closeFileLogger } from './logging/file-logger.js';

// Route plugins — sandbox mode (local simulation)
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

// Route plugin — proxy mode (forward to upstream)
import { proxyRoutes } from './routes/proxy-routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const isProxyMode = config.mode === 'proxy';

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

  // Database is only needed in sandbox mode
  if (!isProxyMode) {
    await app.register(databasePlugin);
  }

  // Core middleware
  await app.register(authPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(rateLimiterPlugin);

  // Initialize file logger in proxy mode
  if (isProxyMode) {
    initFileLogger(config.logFilePath);
    app.addHook('onClose', () => {
      closeFileLogger();
    });
  }

  // Health check — enhanced with mode, upstream status, uptime
  app.get('/health', async () => {
    let upstreamReachable = false;
    try {
      const res = await fetch(config.upstream.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      // Any response (even 4xx) means the server is reachable
      upstreamReachable = res.status < 500;
    } catch {
      upstreamReachable = false;
    }

    return successResponse({
      status: 'ok',
      mode: config.mode,
      uptime_seconds: Math.floor(process.uptime()),
      upstream: {
        url: config.upstream.baseUrl,
        reachable: upstreamReachable,
      },
    });
  });

  if (isProxyMode) {
    // Proxy mode: forward everything to upstream
    // Routes already proxied in both modes
    await app.register(sessionRoutes);
    await app.register(marketDataRoutes);
    await app.register(marginsRoutes);
    await app.register(websocketRoutes);

    // Proxy routes replace local simulation routes
    await app.register(proxyRoutes);

    // Periodic upstream health check (every 5 minutes)
    const healthInterval = setInterval(async () => {
      try {
        const res = await fetch(config.upstream.baseUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        logRecord({
          level: 'info',
          message: 'HEALTH_CHECK',
          data: { upstream_status: res.status, upstream_reachable: res.status < 500 },
        });
      } catch (err) {
        logRecord({
          level: 'warn',
          message: 'UPSTREAM_UNREACHABLE',
          data: { error: (err as Error).message },
        });
      }
    }, 5 * 60 * 1000);

    app.addHook('onClose', () => {
      clearInterval(healthInterval);
    });
  } else {
    // Sandbox mode: local simulation (existing behavior)
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
  }

  return app;
}

// Config plugin for dependency resolution
export const configPlugin = fp(
  async (fastify: FastifyInstance, opts: { config: AppConfig }) => {
    fastify.decorate('config', opts.config);
  },
  { name: 'config' },
);

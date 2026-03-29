import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply, HTTPMethods } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';
import { logRecord } from '../logging/file-logger.js';
import { injectMarketProtection } from '../middleware/market-protection.js';
import { errorResponse } from '../utils/response.js';

/**
 * Proxy routes plugin — registered in proxy mode only.
 * Replaces local simulation routes (orders, portfolio, GTT, user, alerts, MF, basket)
 * with transparent forwarding to the upstream Kite API.
 *
 * Order mutation endpoints (POST/PUT/DELETE /orders/*) get:
 * - Market protection injection for MARKET/SL-M orders
 * - Structured JSONL logging
 *
 * All other endpoints are forwarded without logging (to avoid log bloat).
 */
export const proxyRoutes = fp(
  async (fastify: FastifyInstance) => {
    // --- Order mutation endpoints (with logging + market protection) ---

    fastify.post('/orders/:variety', async (request: FastifyRequest, reply: FastifyReply) => {
      await forwardOrderWithLogging(fastify, request, reply);
    });

    fastify.put('/orders/:variety/:order_id', async (request: FastifyRequest, reply: FastifyReply) => {
      await forwardOrderWithLogging(fastify, request, reply);
    });

    fastify.delete('/orders/:variety/:order_id', async (request: FastifyRequest, reply: FastifyReply) => {
      await forwardOrderWithLogging(fastify, request, reply);
    });

    // --- Order read endpoints (proxy without file logging) ---

    const orderReadRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'GET', url: '/orders' },
      { method: 'GET', url: '/orders/:order_id' },
      { method: 'GET', url: '/orders/:order_id/trades' },
      { method: 'GET', url: '/trades' },
    ];

    // --- User endpoints ---

    const userRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'GET', url: '/user/profile' },
      { method: 'GET', url: '/user/margins' },
      { method: 'GET', url: '/user/margins/:segment' },
    ];

    // --- Portfolio endpoints ---

    const portfolioRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'GET', url: '/portfolio/holdings' },
      { method: 'GET', url: '/portfolio/holdings/auctions' },
      { method: 'POST', url: '/portfolio/holdings/authorise' },
      { method: 'GET', url: '/portfolio/positions' },
      { method: 'PUT', url: '/portfolio/positions' },
    ];

    // --- GTT endpoints ---

    const gttRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'POST', url: '/gtt/triggers' },
      { method: 'GET', url: '/gtt/triggers' },
      { method: 'GET', url: '/gtt/triggers/:id' },
      { method: 'PUT', url: '/gtt/triggers/:id' },
      { method: 'DELETE', url: '/gtt/triggers/:id' },
    ];

    // --- Alert endpoints ---

    const alertRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'POST', url: '/alerts' },
      { method: 'GET', url: '/alerts' },
      { method: 'GET', url: '/alerts/:alert_id' },
      { method: 'PUT', url: '/alerts/:alert_id' },
      { method: 'DELETE', url: '/alerts/:alert_id' },
    ];

    // --- Mutual fund endpoints ---

    const mfRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'POST', url: '/mf/orders' },
      { method: 'GET', url: '/mf/orders' },
      { method: 'GET', url: '/mf/orders/:order_id' },
      { method: 'PUT', url: '/mf/orders/:order_id' },
      { method: 'DELETE', url: '/mf/orders/:order_id' },
      { method: 'POST', url: '/mf/sips' },
      { method: 'GET', url: '/mf/sips' },
      { method: 'GET', url: '/mf/sips/:sip_id' },
      { method: 'PUT', url: '/mf/sips/:sip_id' },
      { method: 'DELETE', url: '/mf/sips/:sip_id' },
      { method: 'GET', url: '/mf/holdings' },
    ];

    // --- Basket endpoint ---

    const basketRoutes: Array<{ method: HTTPMethods; url: string }> = [
      { method: 'POST', url: '/connect/basket' },
    ];

    // Register all simple proxy routes
    const allSimpleRoutes = [
      ...orderReadRoutes,
      ...userRoutes,
      ...portfolioRoutes,
      ...gttRoutes,
      ...alertRoutes,
      ...mfRoutes,
      ...basketRoutes,
    ];

    for (const route of allSimpleRoutes) {
      fastify.route({
        method: route.method,
        url: route.url,
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
          await proxyToKite(fastify, request, reply);
        },
      });
    }
  },
  { name: 'proxy-routes' },
);

/**
 * Forward an order mutation request to upstream with:
 * - Market protection injection (MARKET/SL-M orders)
 * - Structured JSONL logging
 * - No retries (dangerous for real-money order mutations)
 */
async function forwardOrderWithLogging(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const startTime = Date.now();
  const config = fastify.config.upstream;
  const method = request.method;
  const rawPath = request.url.split('?')[0]!;
  const url = `${config.baseUrl}${request.url}`;

  // Build headers
  const headers: Record<string, string> = {};
  if (request.headers.authorization) {
    headers['Authorization'] = request.headers.authorization;
  }
  if (request.headers['x-kite-version']) {
    headers['X-Kite-Version'] = request.headers['x-kite-version'] as string;
  }

  // Process body for POST/PUT — apply market protection injection
  let bodyStr: string | undefined;
  let bodyFields: Record<string, string> = {};
  let marketProtectionInjected = false;

  if ((method === 'POST' || method === 'PUT') && request.body) {
    if (typeof request.body === 'object') {
      bodyFields = { ...(request.body as Record<string, string>) };

      // Market protection injection
      const result = injectMarketProtection(bodyFields);
      bodyFields = result.body;
      marketProtectionInjected = result.injected;

      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(bodyFields)) {
        if (val !== undefined && val !== null) {
          params.append(key, String(val));
        }
      }
      bodyStr = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (typeof request.body === 'string') {
      bodyStr = request.body;
      headers['Content-Type'] = request.headers['content-type'] ?? 'application/x-www-form-urlencoded';
    }
  }

  if (marketProtectionInjected) {
    logRecord({
      level: 'info',
      message: 'MARKET_PROTECTION_INJECTED',
      data: {
        method,
        path: rawPath,
        tradingsymbol: bodyFields.tradingsymbol,
        exchange: bodyFields.exchange,
        order_type: bodyFields.order_type,
      },
    });
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(config.timeout),
    });

    const latencyMs = Date.now() - startTime;
    const responseBody = await response.text();

    // Forward response exactly as received
    const contentType = response.headers.get('content-type');
    if (contentType) reply.header('Content-Type', contentType);
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) reply.header('Retry-After', retryAfter);

    reply.code(response.status);
    reply.send(responseBody);

    // Extract order_id from upstream response
    let upstreamOrderId: string | undefined;
    try {
      const parsed = JSON.parse(responseBody) as { data?: { order_id?: string } };
      upstreamOrderId = parsed?.data?.order_id;
    } catch { /* not JSON or no order_id */ }

    // Extract variety from path: /orders/<variety>/...
    const pathParts = rawPath.split('/');
    const variety = pathParts[2];

    const level = response.status >= 500 ? 'error'
               : response.status === 429 ? 'warn'
               : response.status >= 400 ? 'warn'
               : 'info';
    const message = response.status === 429 ? 'RATE_LIMITED'
                  : response.status >= 500 ? 'ORDER_ERROR'
                  : response.status >= 400 ? 'ORDER_REJECTED'
                  : 'ORDER_FORWARDED';

    logRecord({
      level,
      message,
      data: {
        method,
        path: rawPath,
        tradingsymbol: bodyFields.tradingsymbol || undefined,
        exchange: bodyFields.exchange || undefined,
        transaction_type: bodyFields.transaction_type || undefined,
        order_type: bodyFields.order_type || undefined,
        quantity: bodyFields.quantity ? parseInt(bodyFields.quantity, 10) : undefined,
        product: bodyFields.product || undefined,
        variety,
        market_protection_injected: marketProtectionInjected,
        upstream_status: response.status,
        upstream_order_id: upstreamOrderId,
        latency_ms: latencyMs,
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;

    logRecord({
      level: 'error',
      message: 'ORDER_ERROR',
      data: {
        method,
        path: rawPath,
        error: (err as Error).message,
        latency_ms: latencyMs,
      },
    });

    reply.code(502).send(
      errorResponse(
        `Upstream Kite API request failed: ${(err as Error).message ?? 'Unknown error'}`,
        'NetworkException',
      ),
    );
  }
}

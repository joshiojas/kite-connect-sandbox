import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { errorResponse } from '../utils/response.js';
import type { RateLimitsConfig } from '../types/config.js';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

function getRateLimit(url: string, config: RateLimitsConfig): number {
  if (url.startsWith('/quote')) return config.quote;
  if (url.includes('/historical/')) return config.historical;
  if (url.startsWith('/orders')) return config.orders;
  return config.default;
}

export const rateLimiterPlugin = fp(
  async (fastify: FastifyInstance) => {
    const config = fastify.config.rateLimits;

    if (!config.enabled) return;

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === '/health') return;

      const key = `${request.apiKey || 'anon'}:${request.url.split('?')[0]}`;
      const limit = getRateLimit(request.url, config);
      const now = Date.now();
      const windowMs = 1000; // 1 second window

      let bucket = buckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count++;
      if (bucket.count > limit) {
        reply.code(429).send(errorResponse(
          'Too many requests. Rate limit exceeded.',
          'GeneralException',
        ));
        return;
      }
    });

    // Periodically clean expired buckets
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (now >= bucket.resetAt) {
          buckets.delete(key);
        }
      }
    }, 60000);

    fastify.addHook('onClose', () => {
      clearInterval(cleanup);
    });
  },
  { name: 'rate-limiter' },
);

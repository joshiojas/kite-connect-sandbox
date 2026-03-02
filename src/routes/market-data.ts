import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';

export const marketDataRoutes = fp(
  async (fastify: FastifyInstance) => {
    // GET /quote — Forward with auth header
    fastify.get('/quote', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /quote/ohlc — Forward
    fastify.get('/quote/ohlc', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /quote/ltp — Forward
    fastify.get('/quote/ltp', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /instruments — Forward (CSV)
    fastify.get('/instruments', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /instruments/:exchange — Forward (CSV)
    fastify.get('/instruments/:exchange', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /instruments/historical/:token/:interval — Forward
    fastify.get(
      '/instruments/historical/:token/:interval',
      async (request: FastifyRequest, reply: FastifyReply) => {
        await proxyToKite(fastify, request, reply);
      },
    );
  },
  { name: 'market-data-routes' },
);

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';

export const marginsRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /margins/orders — Forward (uses real margin data)
    fastify.post('/margins/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // POST /margins/basket — Forward
    fastify.post('/margins/basket', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // POST /charges/orders — Forward
    fastify.post('/charges/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });
  },
  { name: 'margins-routes' },
);

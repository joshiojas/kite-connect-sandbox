import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';

export const sessionRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /session/token — Proxy to Kite, also init portfolio on success
    fastify.post('/session/token', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // POST /session/refresh_token — Straight passthrough
    fastify.post('/session/refresh_token', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // DELETE /session/token — Straight passthrough
    fastify.delete('/session/token', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });
  },
  { name: 'session-routes' },
);

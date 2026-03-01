import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';
import { PortfolioManager } from '../portfolio/portfolio-manager.js';
import { successResponse } from '../utils/response.js';

export const userRoutes = fp(
  async (fastify: FastifyInstance) => {
    const pm = new PortfolioManager(fastify.db, fastify.config);

    // GET /user/profile — Proxy passthrough
    fastify.get('/user/profile', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });

    // GET /user/margins — Sandbox margins
    fastify.get('/user/margins', async (request: FastifyRequest, reply: FastifyReply) => {
      const margins = pm.getMargins(request.apiKey);
      reply.send(successResponse(margins));
    });

    // GET /user/margins/:segment — Sandbox margins for segment
    fastify.get<{ Params: { segment: string } }>(
      '/user/margins/:segment',
      async (request: FastifyRequest<{ Params: { segment: string } }>, reply: FastifyReply) => {
        const margins = pm.getMargins(request.apiKey, request.params.segment);
        const segment = request.params.segment as 'equity' | 'commodity';
        reply.send(successResponse(margins[segment] || margins.equity));
      },
    );
  },
  { name: 'user-routes' },
);

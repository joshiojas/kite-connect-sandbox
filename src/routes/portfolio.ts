import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioManager } from '../portfolio/portfolio-manager.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const portfolioRoutes = fp(
  async (fastify: FastifyInstance) => {
    const pm = new PortfolioManager(fastify.db, fastify.config);

    // GET /portfolio/holdings — Return sandbox holdings
    fastify.get('/portfolio/holdings', async (request: FastifyRequest, reply: FastifyReply) => {
      const holdings = pm.getHoldings(request.apiKey);
      reply.send(successResponse(holdings));
    });

    // GET /portfolio/holdings/auctions — Return empty array
    fastify.get('/portfolio/holdings/auctions', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.send(successResponse([]));
    });

    // POST /portfolio/holdings/authorise — No-op, return success
    fastify.post('/portfolio/holdings/authorise', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.send(successResponse(true));
    });

    // GET /portfolio/positions — Return day + net positions
    fastify.get('/portfolio/positions', async (request: FastifyRequest, reply: FastifyReply) => {
      const positions = pm.getPositions(request.apiKey);
      reply.send(successResponse(positions));
    });

    // PUT /portfolio/positions — Convert product type
    fastify.put('/portfolio/positions', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;

      if (!body.tradingsymbol || !body.exchange || !body.old_product || !body.new_product || !body.quantity || !body.transaction_type || !body.position_type) {
        reply.code(400).send(errorResponse('Missing required parameters', 'InputException'));
        return;
      }

      const success = pm.convertPosition(request.apiKey, {
        tradingsymbol: body.tradingsymbol,
        exchange: body.exchange,
        transaction_type: body.transaction_type,
        position_type: body.position_type,
        quantity: parseInt(body.quantity, 10),
        old_product: body.old_product,
        new_product: body.new_product,
      });

      if (!success) {
        reply.code(400).send(errorResponse('Position conversion failed. Insufficient quantity or position not found.', 'OrderException'));
        return;
      }

      reply.send(successResponse(true));
    });
  },
  { name: 'portfolio-routes' },
);

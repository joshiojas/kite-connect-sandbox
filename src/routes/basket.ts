import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderError } from '../portfolio/order-engine.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const basketRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /connect/basket — Intercept, simulate basket order
    fastify.post('/connect/basket', async (request: FastifyRequest, reply: FastifyReply) => {
      const engine = fastify.orderEngine;
      if (!engine) {
        reply.code(500).send(errorResponse('Order engine not available'));
        return;
      }

      const body = request.body as Record<string, unknown>;
      const orders = (body.orders || []) as Array<Record<string, string>>;
      const authHeader = request.headers.authorization || '';

      const results: Array<{ order_id: string } | { error: string }> = [];

      for (const orderParams of orders) {
        try {
          const result = await engine.placeOrder(request.apiKey, {
            variety: 'regular',
            exchange: orderParams.exchange || '',
            tradingsymbol: orderParams.tradingsymbol || '',
            transaction_type: orderParams.transaction_type as 'BUY' | 'SELL',
            order_type: orderParams.order_type as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
            product: orderParams.product as 'CNC' | 'NRML' | 'MIS' | 'MTF',
            quantity: parseInt(orderParams.quantity || '0', 10),
            price: orderParams.price ? parseFloat(orderParams.price) : undefined,
            trigger_price: orderParams.trigger_price ? parseFloat(orderParams.trigger_price) : undefined,
            tag: orderParams.tag,
          }, authHeader);
          results.push(result);
        } catch (err) {
          results.push({ error: (err as Error).message });
        }
      }

      reply.send(successResponse(results));
    });
  },
  { name: 'basket-routes' },
);

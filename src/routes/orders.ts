import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderEngine, OrderError } from '../portfolio/order-engine.js';
import { successResponse, errorResponse, httpStatusForError } from '../utils/response.js';
import type { KiteErrorType } from '../types/kite.js';

declare module 'fastify' {
  interface FastifyInstance {
    orderEngine: OrderEngine;
  }
}

export const ordersRoutes = fp(
  async (fastify: FastifyInstance) => {
    const engine = new OrderEngine(fastify.db, fastify.config, fastify);

    // Store engine on fastify for access by other routes
    fastify.decorate('orderEngine', engine);

    // POST /orders/:variety — Place order
    fastify.post<{ Params: { variety: string } }>(
      '/orders/:variety',
      async (request: FastifyRequest<{ Params: { variety: string } }>, reply: FastifyReply) => {
        try {
          const body = request.body as Record<string, string>;
          const result = await engine.placeOrder(request.apiKey, {
            variety: request.params.variety,
            exchange: body.exchange || '',
            tradingsymbol: body.tradingsymbol || '',
            transaction_type: body.transaction_type as 'BUY' | 'SELL',
            order_type: body.order_type as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
            product: body.product as 'CNC' | 'NRML' | 'MIS' | 'MTF',
            quantity: parseInt(body.quantity || '0', 10),
            price: body.price ? parseFloat(body.price) : undefined,
            trigger_price: body.trigger_price ? parseFloat(body.trigger_price) : undefined,
            disclosed_quantity: body.disclosed_quantity ? parseInt(body.disclosed_quantity, 10) : undefined,
            validity: body.validity,
            validity_ttl: body.validity_ttl ? parseInt(body.validity_ttl, 10) : undefined,
            tag: body.tag,
          }, request.headers.authorization || '');

          reply.code(200).send(successResponse(result));
        } catch (err) {
          if (err instanceof OrderError) {
            const status = httpStatusForError(err.errorType as KiteErrorType);
            reply.code(status).send(errorResponse(err.message, err.errorType as KiteErrorType));
          } else {
            reply.code(500).send(errorResponse((err as Error).message));
          }
        }
      },
    );

    // PUT /orders/:variety/:order_id — Modify order
    fastify.put<{ Params: { variety: string; order_id: string } }>(
      '/orders/:variety/:order_id',
      async (request: FastifyRequest<{ Params: { variety: string; order_id: string } }>, reply: FastifyReply) => {
        try {
          const body = request.body as Record<string, string>;
          const result = engine.modifyOrder(request.apiKey, request.params.variety, request.params.order_id, {
            order_type: body.order_type as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M' | undefined,
            quantity: body.quantity ? parseInt(body.quantity, 10) : undefined,
            price: body.price ? parseFloat(body.price) : undefined,
            trigger_price: body.trigger_price ? parseFloat(body.trigger_price) : undefined,
            disclosed_quantity: body.disclosed_quantity ? parseInt(body.disclosed_quantity, 10) : undefined,
            validity: body.validity,
          });

          reply.code(200).send(successResponse(result));
        } catch (err) {
          if (err instanceof OrderError) {
            const status = httpStatusForError(err.errorType as KiteErrorType);
            reply.code(status).send(errorResponse(err.message, err.errorType as KiteErrorType));
          } else {
            reply.code(500).send(errorResponse((err as Error).message));
          }
        }
      },
    );

    // DELETE /orders/:variety/:order_id — Cancel order
    fastify.delete<{ Params: { variety: string; order_id: string } }>(
      '/orders/:variety/:order_id',
      async (request: FastifyRequest<{ Params: { variety: string; order_id: string } }>, reply: FastifyReply) => {
        try {
          const result = engine.cancelOrder(request.apiKey, request.params.variety, request.params.order_id);
          reply.code(200).send(successResponse(result));
        } catch (err) {
          if (err instanceof OrderError) {
            const status = httpStatusForError(err.errorType as KiteErrorType);
            reply.code(status).send(errorResponse(err.message, err.errorType as KiteErrorType));
          } else {
            reply.code(500).send(errorResponse((err as Error).message));
          }
        }
      },
    );

    // GET /orders — All today's orders
    fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      const orders = engine.getOrders(request.apiKey);
      reply.send(successResponse(orders));
    });

    // GET /orders/:order_id — Order history (status transitions)
    fastify.get<{ Params: { order_id: string } }>(
      '/orders/:order_id',
      async (request: FastifyRequest<{ Params: { order_id: string } }>, reply: FastifyReply) => {
        const history = engine.getOrderHistory(request.apiKey, request.params.order_id);
        reply.send(successResponse(history));
      },
    );

    // GET /orders/:order_id/trades — Trades for this order
    fastify.get<{ Params: { order_id: string } }>(
      '/orders/:order_id/trades',
      async (request: FastifyRequest<{ Params: { order_id: string } }>, reply: FastifyReply) => {
        const trades = engine.getOrderTrades(request.apiKey, request.params.order_id);
        reply.send(successResponse(trades));
      },
    );

    // GET /trades — All today's trades
    fastify.get('/trades', async (request: FastifyRequest, reply: FastifyReply) => {
      const trades = engine.getAllTrades(request.apiKey);
      reply.send(successResponse(trades));
    });
  },
  { name: 'orders-routes' },
);

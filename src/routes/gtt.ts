import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../utils/response.js';
import { formatTimestamp } from '../utils/timestamp.js';

export const gttRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /gtt/triggers — Create a new GTT
    fastify.post('/gtt/triggers', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;
      const now = formatTimestamp();

      if (!body.type || !body.condition || !body.orders) {
        reply.code(400).send(errorResponse('Missing required parameters', 'InputException'));
        return;
      }

      // Calculate expiry (1 year from now)
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);
      const expiryDate = formatTimestamp(expiry);

      const result = fastify.db.prepare(
        `INSERT INTO gtt_orders (api_key, type, status, condition, orders, meta, expiry_date, created_at, updated_at)
         VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      ).run(
        request.apiKey, body.type, body.condition, body.orders,
        body.meta || null, expiryDate, now, now,
      );

      reply.send(successResponse({ trigger_id: result.lastInsertRowid }));
    });

    // GET /gtt/triggers — List all GTTs
    fastify.get('/gtt/triggers', async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = fastify.db.prepare(
        'SELECT * FROM gtt_orders WHERE api_key = ? ORDER BY created_at DESC',
      ).all(request.apiKey) as Array<Record<string, unknown>>;

      const triggers = rows.map(mapGTT);
      reply.send(successResponse(triggers));
    });

    // GET /gtt/triggers/:id — Get single GTT
    fastify.get<{ Params: { id: string } }>(
      '/gtt/triggers/:id',
      async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const row = fastify.db.prepare(
          'SELECT * FROM gtt_orders WHERE trigger_id = ? AND api_key = ?',
        ).get(parseInt(request.params.id, 10), request.apiKey) as Record<string, unknown> | undefined;

        if (!row) {
          reply.code(404).send(errorResponse('GTT trigger not found', 'DataException'));
          return;
        }

        reply.send(successResponse(mapGTT(row)));
      },
    );

    // PUT /gtt/triggers/:id — Modify GTT
    fastify.put<{ Params: { id: string } }>(
      '/gtt/triggers/:id',
      async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const body = request.body as Record<string, string>;
        const now = formatTimestamp();
        const triggerId = parseInt(request.params.id, 10);

        const existing = fastify.db.prepare(
          'SELECT * FROM gtt_orders WHERE trigger_id = ? AND api_key = ?',
        ).get(triggerId, request.apiKey) as Record<string, unknown> | undefined;

        if (!existing) {
          reply.code(404).send(errorResponse('GTT trigger not found', 'DataException'));
          return;
        }

        fastify.db.prepare(
          `UPDATE gtt_orders SET
            type = COALESCE(?, type),
            condition = COALESCE(?, condition),
            orders = COALESCE(?, orders),
            updated_at = ?
          WHERE trigger_id = ? AND api_key = ?`,
        ).run(body.type || null, body.condition || null, body.orders || null, now, triggerId, request.apiKey);

        reply.send(successResponse({ trigger_id: triggerId }));
      },
    );

    // DELETE /gtt/triggers/:id — Delete GTT
    fastify.delete<{ Params: { id: string } }>(
      '/gtt/triggers/:id',
      async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const triggerId = parseInt(request.params.id, 10);

        const result = fastify.db.prepare(
          "UPDATE gtt_orders SET status = 'deleted', updated_at = ? WHERE trigger_id = ? AND api_key = ?",
        ).run(formatTimestamp(), triggerId, request.apiKey);

        if (result.changes === 0) {
          reply.code(404).send(errorResponse('GTT trigger not found', 'DataException'));
          return;
        }

        reply.send(successResponse({ trigger_id: triggerId }));
      },
    );
  },
  { name: 'gtt-routes' },
);

function mapGTT(row: Record<string, unknown>) {
  let condition = {};
  let orders: unknown[] = [];
  try { condition = JSON.parse(row.condition as string); } catch { /* empty */ }
  try { orders = JSON.parse(row.orders as string) as unknown[]; } catch { /* empty */ }

  return {
    id: row.trigger_id as number,
    user_id: row.api_key as string,
    type: row.type as string,
    status: row.status as string,
    condition,
    orders,
    meta: row.meta ? JSON.parse(row.meta as string) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    expires_at: row.expiry_date as string,
  };
}

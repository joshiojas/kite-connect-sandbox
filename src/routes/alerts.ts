import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse, errorResponse } from '../utils/response.js';
import { formatTimestamp } from '../utils/timestamp.js';
import { generateUuid } from '../utils/id-generator.js';

export const alertsRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /alerts — Create alert
    fastify.post('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;
      const now = formatTimestamp();
      const uuid = generateUuid();

      if (!body.type || !body.condition) {
        reply.code(400).send(errorResponse('Missing required parameters', 'InputException'));
        return;
      }

      fastify.db.prepare(
        `INSERT INTO alerts (uuid, api_key, type, status, condition, basket, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      ).run(uuid, request.apiKey, body.type, body.condition, body.basket || null, now, now);

      reply.send(successResponse({ uuid }));
    });

    // GET /alerts — List all alerts
    fastify.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = fastify.db.prepare(
        'SELECT * FROM alerts WHERE api_key = ? ORDER BY created_at DESC',
      ).all(request.apiKey) as Array<Record<string, unknown>>;

      reply.send(successResponse(rows.map(mapAlert)));
    });

    // GET /alerts/:uuid — Get single alert
    fastify.get<{ Params: { uuid: string } }>(
      '/alerts/:uuid',
      async (request: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) => {
        const row = fastify.db.prepare(
          'SELECT * FROM alerts WHERE uuid = ? AND api_key = ?',
        ).get(request.params.uuid, request.apiKey) as Record<string, unknown> | undefined;

        if (!row) {
          reply.code(404).send(errorResponse('Alert not found', 'DataException'));
          return;
        }

        reply.send(successResponse(mapAlert(row)));
      },
    );

    // PUT /alerts/:uuid — Modify alert
    fastify.put<{ Params: { uuid: string } }>(
      '/alerts/:uuid',
      async (request: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) => {
        const body = request.body as Record<string, string>;
        const now = formatTimestamp();

        const result = fastify.db.prepare(
          `UPDATE alerts SET
            condition = COALESCE(?, condition),
            basket = COALESCE(?, basket),
            updated_at = ?
          WHERE uuid = ? AND api_key = ?`,
        ).run(body.condition || null, body.basket || null, now, request.params.uuid, request.apiKey);

        if (result.changes === 0) {
          reply.code(404).send(errorResponse('Alert not found', 'DataException'));
          return;
        }

        reply.send(successResponse({ uuid: request.params.uuid }));
      },
    );

    // DELETE /alerts — Delete alert(s) by uuid query param
    fastify.delete('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const uuid = query.uuid;

      if (uuid) {
        fastify.db.prepare(
          "UPDATE alerts SET status = 'deleted', updated_at = ? WHERE uuid = ? AND api_key = ?",
        ).run(formatTimestamp(), uuid, request.apiKey);
      }

      reply.send(successResponse(true));
    });

    // GET /alerts/:uuid/history — Return trigger history (empty for sandbox)
    fastify.get<{ Params: { uuid: string } }>(
      '/alerts/:uuid/history',
      async (request: FastifyRequest<{ Params: { uuid: string } }>, reply: FastifyReply) => {
        reply.send(successResponse([]));
      },
    );
  },
  { name: 'alerts-routes' },
);

function mapAlert(row: Record<string, unknown>) {
  let condition = {};
  let basket = null;
  try { condition = JSON.parse(row.condition as string); } catch { /* empty */ }
  try { basket = row.basket ? JSON.parse(row.basket as string) : null; } catch { /* empty */ }

  return {
    uuid: row.uuid as string,
    type: row.type as string,
    status: row.status as string,
    condition,
    basket,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

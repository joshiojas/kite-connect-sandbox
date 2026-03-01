import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { proxyToKite } from '../proxy/kite-proxy.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { formatTimestamp } from '../utils/timestamp.js';
import { generateOrderId, generateUuid } from '../utils/id-generator.js';

export const mutualFundsRoutes = fp(
  async (fastify: FastifyInstance) => {
    // POST /mf/orders — Simulate MF order
    fastify.post('/mf/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;
      const now = formatTimestamp();
      const orderId = generateOrderId();

      if (!body.tradingsymbol || !body.transaction_type) {
        reply.code(400).send(errorResponse('Missing required parameters', 'InputException'));
        return;
      }

      fastify.db.prepare(
        `INSERT INTO mf_orders (
          order_id, api_key, tradingsymbol, status, status_message, fund,
          transaction_type, variety, purchase_type, quantity, amount,
          last_price, average_price, placed_by, tag,
          order_timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, 'COMPLETE', '', ?, ?, 'regular', 'fresh', ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      ).run(
        orderId, request.apiKey, body.tradingsymbol, body.fund || '',
        body.transaction_type, parseFloat(body.quantity || '0'), parseFloat(body.amount || '0'),
        request.apiKey, body.tag || null, now, now, now,
      );

      reply.send(successResponse({ order_id: orderId }));
    });

    // GET /mf/orders — Return sandbox MF orders
    fastify.get('/mf/orders', async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = fastify.db.prepare(
        'SELECT * FROM mf_orders WHERE api_key = ? ORDER BY created_at DESC',
      ).all(request.apiKey) as Array<Record<string, unknown>>;
      reply.send(successResponse(rows.map(mapMFOrder)));
    });

    // GET /mf/orders/:order_id — Return single MF order
    fastify.get<{ Params: { order_id: string } }>(
      '/mf/orders/:order_id',
      async (request: FastifyRequest<{ Params: { order_id: string } }>, reply: FastifyReply) => {
        const row = fastify.db.prepare(
          'SELECT * FROM mf_orders WHERE order_id = ? AND api_key = ?',
        ).get(request.params.order_id, request.apiKey) as Record<string, unknown> | undefined;

        if (!row) {
          reply.code(404).send(errorResponse('MF order not found', 'DataException'));
          return;
        }
        reply.send(successResponse(mapMFOrder(row)));
      },
    );

    // DELETE /mf/orders/:order_id — Cancel MF order
    fastify.delete<{ Params: { order_id: string } }>(
      '/mf/orders/:order_id',
      async (request: FastifyRequest<{ Params: { order_id: string } }>, reply: FastifyReply) => {
        const result = fastify.db.prepare(
          "UPDATE mf_orders SET status = 'CANCELLED', updated_at = ? WHERE order_id = ? AND api_key = ?",
        ).run(formatTimestamp(), request.params.order_id, request.apiKey);

        if (result.changes === 0) {
          reply.code(404).send(errorResponse('MF order not found', 'DataException'));
          return;
        }
        reply.send(successResponse({ order_id: request.params.order_id }));
      },
    );

    // POST /mf/sips — Simulate SIP creation
    fastify.post('/mf/sips', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string>;
      const now = formatTimestamp();
      const sipId = generateUuid();

      if (!body.tradingsymbol || !body.instalment_amount || !body.frequency || !body.instalments || !body.initial_amount) {
        reply.code(400).send(errorResponse('Missing required parameters', 'InputException'));
        return;
      }

      fastify.db.prepare(
        `INSERT INTO mf_sips (
          sip_id, api_key, tradingsymbol, fund, dividend_type, transaction_type,
          status, instalments, frequency, instalment_amount, instalment_day,
          created, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'growth', 'BUY', 'active', ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        sipId, request.apiKey, body.tradingsymbol, body.fund || '',
        parseInt(body.instalments || '0', 10), body.frequency,
        parseFloat(body.instalment_amount), parseInt(body.instalment_day || '1', 10),
        now, now, now,
      );

      reply.send(successResponse({ sip_id: sipId }));
    });

    // GET /mf/sips — Return sandbox SIPs
    fastify.get('/mf/sips', async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = fastify.db.prepare(
        'SELECT * FROM mf_sips WHERE api_key = ? ORDER BY created_at DESC',
      ).all(request.apiKey) as Array<Record<string, unknown>>;
      reply.send(successResponse(rows.map(mapMFSip)));
    });

    // GET /mf/sips/:sip_id
    fastify.get<{ Params: { sip_id: string } }>(
      '/mf/sips/:sip_id',
      async (request: FastifyRequest<{ Params: { sip_id: string } }>, reply: FastifyReply) => {
        const row = fastify.db.prepare(
          'SELECT * FROM mf_sips WHERE sip_id = ? AND api_key = ?',
        ).get(request.params.sip_id, request.apiKey) as Record<string, unknown> | undefined;

        if (!row) {
          reply.code(404).send(errorResponse('SIP not found', 'DataException'));
          return;
        }
        reply.send(successResponse(mapMFSip(row)));
      },
    );

    // PUT /mf/sips/:sip_id — Modify SIP
    fastify.put<{ Params: { sip_id: string } }>(
      '/mf/sips/:sip_id',
      async (request: FastifyRequest<{ Params: { sip_id: string } }>, reply: FastifyReply) => {
        const body = request.body as Record<string, string>;
        const now = formatTimestamp();

        const updates: string[] = ['updated_at = ?'];
        const values: unknown[] = [now];

        if (body.instalment_amount) { updates.push('instalment_amount = ?'); values.push(parseFloat(body.instalment_amount)); }
        if (body.frequency) { updates.push('frequency = ?'); values.push(body.frequency); }
        if (body.instalments) { updates.push('instalments = ?'); values.push(parseInt(body.instalments, 10)); }
        if (body.status) { updates.push('status = ?'); values.push(body.status); }

        values.push(request.params.sip_id, request.apiKey);

        const result = fastify.db.prepare(
          `UPDATE mf_sips SET ${updates.join(', ')} WHERE sip_id = ? AND api_key = ?`,
        ).run(...values);

        if (result.changes === 0) {
          reply.code(404).send(errorResponse('SIP not found', 'DataException'));
          return;
        }
        reply.send(successResponse({ sip_id: request.params.sip_id }));
      },
    );

    // DELETE /mf/sips/:sip_id — Cancel SIP
    fastify.delete<{ Params: { sip_id: string } }>(
      '/mf/sips/:sip_id',
      async (request: FastifyRequest<{ Params: { sip_id: string } }>, reply: FastifyReply) => {
        const result = fastify.db.prepare(
          "UPDATE mf_sips SET status = 'cancelled', updated_at = ? WHERE sip_id = ? AND api_key = ?",
        ).run(formatTimestamp(), request.params.sip_id, request.apiKey);

        if (result.changes === 0) {
          reply.code(404).send(errorResponse('SIP not found', 'DataException'));
          return;
        }
        reply.send(successResponse({ sip_id: request.params.sip_id }));
      },
    );

    // GET /mf/holdings — Return sandbox MF holdings
    fastify.get('/mf/holdings', async (request: FastifyRequest, reply: FastifyReply) => {
      const rows = fastify.db.prepare(
        'SELECT * FROM mf_holdings WHERE api_key = ?',
      ).all(request.apiKey) as Array<Record<string, unknown>>;
      reply.send(successResponse(rows.map(mapMFHolding)));
    });

    // GET /mf/instruments — Proxy (CSV)
    fastify.get('/mf/instruments', async (request: FastifyRequest, reply: FastifyReply) => {
      await proxyToKite(fastify, request, reply);
    });
  },
  { name: 'mutual-funds-routes' },
);

function mapMFOrder(row: Record<string, unknown>) {
  return {
    order_id: row.order_id as string,
    exchange_order_id: (row.exchange_order_id as string) || null,
    tradingsymbol: row.tradingsymbol as string,
    status: row.status as string,
    status_message: (row.status_message as string) || '',
    folio: (row.folio as string) || null,
    fund: (row.fund as string) || '',
    order_timestamp: (row.order_timestamp as string) || '',
    exchange_timestamp: (row.exchange_timestamp as string) || null,
    settlement_id: (row.settlement_id as string) || null,
    transaction_type: row.transaction_type as string,
    variety: (row.variety as string) || 'regular',
    purchase_type: (row.purchase_type as string) || 'fresh',
    quantity: (row.quantity as number) || 0,
    amount: (row.amount as number) || 0,
    last_price: (row.last_price as number) || 0,
    average_price: (row.average_price as number) || 0,
    placed_by: (row.placed_by as string) || '',
    tag: (row.tag as string) || null,
  };
}

function mapMFSip(row: Record<string, unknown>) {
  let stepUp = {};
  try { stepUp = JSON.parse((row.step_up as string) || '{}'); } catch { /* empty */ }

  return {
    sip_id: row.sip_id as string,
    tradingsymbol: row.tradingsymbol as string,
    fund: (row.fund as string) || '',
    dividend_type: (row.dividend_type as string) || 'growth',
    transaction_type: (row.transaction_type as string) || 'BUY',
    status: row.status as string,
    sip_type: (row.sip_type as string) || 'normal',
    instalments: (row.instalments as number) || 0,
    frequency: (row.frequency as string) || 'monthly',
    instalment_amount: (row.instalment_amount as number) || 0,
    instalment_day: (row.instalment_day as number) || 1,
    completed_instalments: (row.completed_instalments as number) || 0,
    pending_instalments: (row.pending_instalments as number) || 0,
    created: (row.created as string) || '',
    last_instalment: (row.last_instalment as string) || '',
    next_instalment: (row.next_instalment as string) || '',
    step_up: stepUp,
    tag: (row.tag as string) || null,
  };
}

function mapMFHolding(row: Record<string, unknown>) {
  return {
    folio: (row.folio as string) || '',
    fund: (row.fund as string) || '',
    tradingsymbol: row.tradingsymbol as string,
    average_price: (row.average_price as number) || 0,
    last_price: (row.last_price as number) || 0,
    last_price_date: (row.last_price_date as string) || '',
    pnl: (row.pnl as number) || 0,
    quantity: (row.quantity as number) || 0,
    pledge_quantity: (row.pledge_quantity as number) || 0,
  };
}

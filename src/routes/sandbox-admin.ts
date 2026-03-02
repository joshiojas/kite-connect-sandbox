import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PortfolioManager } from '../portfolio/portfolio-manager.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { formatTimestamp } from '../utils/timestamp.js';

export const sandboxAdminRoutes = fp(
  async (fastify: FastifyInstance) => {
    const pm = new PortfolioManager(fastify.db, fastify.config);

    // GET /sandbox/dashboard — Portfolio summary
    fastify.get('/sandbox/dashboard', async (_request: FastifyRequest, reply: FastifyReply) => {
      const portfolios = fastify.db.prepare('SELECT * FROM portfolios').all() as Array<Record<string, unknown>>;

      const summaries = portfolios.map((p) => {
        const apiKey = p.api_key as string;
        const openOrders = fastify.db.prepare(
          "SELECT COUNT(*) as count FROM orders WHERE api_key = ? AND status IN ('OPEN', 'OPEN PENDING', 'TRIGGER PENDING')",
        ).get(apiKey) as { count: number };

        const todayTrades = fastify.db.prepare(
          "SELECT COUNT(*) as count FROM trades WHERE api_key = ? AND fill_timestamp >= date('now')",
        ).get(apiKey) as { count: number };

        const holdingsCount = fastify.db.prepare(
          'SELECT COUNT(*) as count FROM holdings WHERE api_key = ? AND quantity > 0',
        ).get(apiKey) as { count: number };

        const realised = fastify.db.prepare(
          'SELECT COALESCE(SUM(realised), 0) as total FROM positions WHERE api_key = ?',
        ).get(apiKey) as { total: number };

        const unrealised = fastify.db.prepare(
          'SELECT COALESCE(SUM(unrealised), 0) as total FROM positions WHERE api_key = ?',
        ).get(apiKey) as { total: number };

        return {
          api_key: apiKey,
          initial_capital: p.initial_capital as number,
          current_value: (p.available_cash as number) + (p.used_margin as number),
          available_cash: p.available_cash as number,
          open_orders: openOrders.count,
          total_trades_today: todayTrades.count,
          holdings_count: holdingsCount.count,
          pnl: {
            realised: realised.total,
            unrealised: unrealised.total,
            total: realised.total + unrealised.total,
          },
        };
      });

      reply.send(successResponse({ portfolios: summaries }));
    });

    // POST /sandbox/reset — Wipe and reset portfolio
    fastify.post('/sandbox/reset', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const apiKey = query.api_key;

      if (!apiKey) {
        reply.code(400).send(errorResponse('api_key query parameter is required', 'InputException'));
        return;
      }

      pm.resetPortfolio(apiKey);
      reply.send(successResponse({ message: `Portfolio for ${apiKey} has been reset` }));
    });

    // POST /sandbox/settle — EOD settlement
    fastify.post('/sandbox/settle', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const apiKey = query.api_key;
      const now = formatTimestamp();

      const portfolios = apiKey
        ? [{ api_key: apiKey }]
        : (fastify.db.prepare('SELECT api_key FROM portfolios').all() as Array<{ api_key: string }>);

      for (const p of portfolios) {
        const key = p.api_key;

        // Square off all MIS positions
        const misPositions = fastify.db.prepare(
          "SELECT * FROM positions WHERE api_key = ? AND product = 'MIS' AND quantity != 0",
        ).all(key) as Array<Record<string, unknown>>;

        for (const pos of misPositions) {
          const qty = pos.quantity as number;
          const avgPrice = pos.average_price as number;
          const value = Math.abs(qty) * avgPrice;

          if (qty > 0) {
            pm.creditCash(key, value);
          } else {
            pm.debitCash(key, value);
          }

          fastify.db.prepare(
            "UPDATE positions SET quantity = 0, day_buy_quantity = 0, day_sell_quantity = 0, updated_at = ? WHERE api_key = ? AND tradingsymbol = ? AND exchange = ? AND product = 'MIS'",
          ).run(now, key, pos.tradingsymbol as string, pos.exchange as string);
        }

        // Move T+1 quantities to opening quantities in holdings
        fastify.db.prepare(
          'UPDATE holdings SET opening_quantity = opening_quantity + t1_quantity, t1_quantity = 0, updated_at = ? WHERE api_key = ?',
        ).run(now, key);

        // Reset day position fields
        fastify.db.prepare(
          'UPDATE positions SET day_buy_quantity = 0, day_buy_value = 0, day_buy_price = 0, day_sell_quantity = 0, day_sell_value = 0, day_sell_price = 0, overnight_quantity = quantity, updated_at = ? WHERE api_key = ?',
        ).run(now, key);
      }

      reply.send(successResponse({ message: 'EOD settlement complete' }));
    });
  },
  { name: 'sandbox-admin-routes' },
);

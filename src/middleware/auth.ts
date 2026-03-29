import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { errorResponse, httpStatusForError } from '../utils/response.js';
import { formatTimestamp } from '../utils/timestamp.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey: string;
    accessToken: string;
  }
}

export interface AuthInfo {
  apiKey: string;
  accessToken: string;
}

export function parseAuthHeader(header: string | undefined): AuthInfo | null {
  if (!header) return null;
  // Format: "token api_key:access_token"
  const match = header.match(/^token\s+([^:]+):(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { apiKey: match[1], accessToken: match[2] };
}

export const authPlugin = fp(
  async (fastify: FastifyInstance) => {
    fastify.decorateRequest('apiKey', '');
    fastify.decorateRequest('accessToken', '');

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for health check and sandbox admin endpoints
      if (request.url === '/health' || request.url.startsWith('/sandbox/')) {
        return;
      }

      const authHeader = request.headers.authorization;
      const auth = parseAuthHeader(authHeader);

      if (!auth) {
        reply.code(403).send(errorResponse(
          'Incorrect `api_key` or `access_token`.',
          'TokenException',
        ));
        return;
      }

      request.apiKey = auth.apiKey;
      request.accessToken = auth.accessToken;

      // Auto-create portfolio for sandbox mode only (proxy mode has no local DB)
      if (fastify.config.mode !== 'proxy') {
        ensurePortfolio(fastify, auth.apiKey);
      }
    });
  },
  { name: 'auth' },
);

function ensurePortfolio(fastify: FastifyInstance, apiKey: string): void {
  const db = fastify.db;
  const existing = db.prepare('SELECT api_key FROM portfolios WHERE api_key = ?').get(apiKey);
  if (!existing) {
    const now = formatTimestamp();
    const initialCapital = fastify.config.sandbox.initialCapital;
    db.prepare(
      'INSERT INTO portfolios (api_key, initial_capital, available_cash, used_margin, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)',
    ).run(apiKey, initialCapital, initialCapital, now, now);
  }
}

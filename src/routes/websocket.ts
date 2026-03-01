import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { setupWebSocketProxy } from '../proxy/ws-proxy.js';
import { parseAuthHeader } from '../middleware/auth.js';

export const websocketRoutes = fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(websocket);

    fastify.get('/ws', { websocket: true }, (socket, request: FastifyRequest) => {
      const query = request.query as Record<string, string>;
      const apiKey = query.api_key;
      const accessToken = query.access_token;

      if (!apiKey || !accessToken) {
        socket.close(4001, 'Missing api_key or access_token');
        return;
      }

      setupWebSocketProxy(fastify, socket, apiKey, accessToken);
    });
  },
  { name: 'websocket-routes' },
);

import WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';
import type { WebSocket as FastifyWebSocket } from '@fastify/websocket';

export function setupWebSocketProxy(
  fastify: FastifyInstance,
  clientWs: FastifyWebSocket,
  apiKey: string,
  accessToken: string,
): void {
  const wsUrl = fastify.config.upstream.wsUrl;
  const upstreamUrl = `${wsUrl}?api_key=${encodeURIComponent(apiKey)}&access_token=${encodeURIComponent(accessToken)}`;

  const upstream = new WebSocket(upstreamUrl);

  // Store reference to upstream for order postback injection
  (clientWs as unknown as Record<string, unknown>).__upstream = upstream;

  upstream.on('open', () => {
    fastify.log.info({ apiKey }, 'WebSocket upstream connected');
  });

  // Upstream → Client (binary ticks, text messages, heartbeats)
  upstream.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
    try {
      if (clientWs.readyState === WebSocket.OPEN) {
        if (isBinary) {
          clientWs.send(data as Buffer, { binary: true });
        } else {
          clientWs.send(data.toString(), { binary: false });
        }
      }
    } catch (err) {
      fastify.log.error({ error: (err as Error).message }, 'Error forwarding upstream message to client');
    }
  });

  // Client → Upstream (subscribe/unsubscribe/mode messages)
  clientWs.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
    try {
      if (upstream.readyState === WebSocket.OPEN) {
        if (isBinary) {
          upstream.send(data as Buffer, { binary: true });
        } else {
          upstream.send(data.toString(), { binary: false });
        }
      }
    } catch (err) {
      fastify.log.error({ error: (err as Error).message }, 'Error forwarding client message to upstream');
    }
  });

  // Close propagation
  upstream.on('close', (code, reason) => {
    fastify.log.info({ apiKey, code, reason: reason?.toString() }, 'WebSocket upstream closed');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason?.toString());
    }
  });

  clientWs.on('close', (code, reason) => {
    fastify.log.info({ apiKey, code }, 'WebSocket client closed');
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close(code, reason?.toString());
    }
  });

  // Error handling
  upstream.on('error', (err) => {
    fastify.log.error({ error: err.message, apiKey }, 'WebSocket upstream error');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Upstream error');
    }
  });

  clientWs.on('error', (err) => {
    fastify.log.error({ error: err.message, apiKey }, 'WebSocket client error');
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close(1011, 'Client error');
    }
  });
}

export function injectOrderPostback(clientWs: FastifyWebSocket, orderData: Record<string, unknown>): void {
  const postback = JSON.stringify({ type: 'order', data: orderData });
  if (clientWs.readyState === WebSocket.OPEN) {
    clientWs.send(postback, { binary: false });
  }
}

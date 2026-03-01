import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { errorResponse } from '../utils/response.js';

interface ProxyOptions {
  method?: string;
  path?: string;
  body?: string | Buffer | null;
  contentType?: string;
  queryString?: string;
}

export async function proxyToKite(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  options?: ProxyOptions,
): Promise<void> {
  const config = fastify.config.upstream;
  const method = options?.method ?? request.method;
  const path = options?.path ?? request.url;
  const url = `${config.baseUrl}${path}`;

  const headers: Record<string, string> = {};
  if (request.headers.authorization) {
    headers['Authorization'] = request.headers.authorization;
  }
  if (request.headers['x-kite-version']) {
    headers['X-Kite-Version'] = request.headers['x-kite-version'] as string;
  }

  let body: string | undefined;
  if ((method === 'POST' || method === 'PUT') && request.body) {
    if (typeof request.body === 'string') {
      body = request.body;
      headers['Content-Type'] = options?.contentType ?? request.headers['content-type'] ?? 'application/x-www-form-urlencoded';
    } else if (typeof request.body === 'object') {
      // Convert object to form-urlencoded
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(request.body as Record<string, string>)) {
        if (val !== undefined && val !== null) {
          params.append(key, String(val));
        }
      }
      body = params.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout);

  let lastError: Error | null = null;
  const maxRetries = config.retries;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Forward response headers
      const contentType = response.headers.get('content-type');
      if (contentType) {
        reply.header('Content-Type', contentType);
      }

      reply.code(response.status);

      // Stream body
      const responseBody = await response.text();
      reply.send(responseBody);
      return;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries && !controller.signal.aborted) {
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  clearTimeout(timeout);

  fastify.log.error({ error: lastError?.message, url }, 'Upstream proxy error');
  reply.code(502).send(
    errorResponse(
      `Upstream Kite API request failed: ${lastError?.message ?? 'Unknown error'}`,
      'NetworkException',
    ),
  );
}

export async function fetchLTP(
  fastify: FastifyInstance,
  authHeader: string,
  instruments: string[],
): Promise<Record<string, { last_price: number }>> {
  const config = fastify.config.upstream;
  const params = instruments.map((i) => `i=${encodeURIComponent(i)}`).join('&');
  const url = `${config.baseUrl}/quote/ltp?${params}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      return {};
    }

    const json = (await response.json()) as { status: string; data: Record<string, { last_price: number }> };
    if (json.status === 'success') {
      return json.data;
    }
    return {};
  } catch {
    return {};
  }
}

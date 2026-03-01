import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export const requestLoggerPlugin = fp(
  async (fastify: FastifyInstance) => {
    fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
      const elapsed = reply.elapsedTime?.toFixed(1) ?? '?';
      fastify.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: `${elapsed}ms`,
        },
        `${request.method} ${request.url} ${reply.statusCode} ${elapsed}ms`,
      );
      done();
    });
  },
  { name: 'request-logger' },
);

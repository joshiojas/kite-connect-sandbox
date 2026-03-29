import { loadConfig } from './config.js';
import { buildApp } from './server.js';
import { logRecord } from './logging/file-logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.server.port, host: config.server.host });

    if (config.mode === 'proxy') {
      console.log(`🚀 Kite Connect Sandbox starting in PROXY mode`);
      console.log(`   Upstream: ${config.upstream.baseUrl}`);
      console.log(`   Port: ${config.server.port}`);
      console.log(`   All order endpoints will be forwarded to upstream`);
      console.log(`   Note: HTTPS is handled by Nginx — this app listens on plain HTTP`);

      logRecord({
        level: 'info',
        message: 'PROXY_STARTED',
        data: { mode: 'proxy', upstream: config.upstream.baseUrl, port: config.server.port },
      });
    } else {
      console.log(`🚀 Kite Connect Sandbox starting in SANDBOX mode`);
      console.log(`   Upstream: ${config.upstream.baseUrl}`);
      console.log(`   Port: ${config.server.port}`);
      console.log(`   Orders will be simulated locally`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

import { loadConfig } from './config.js';
import { buildApp } from './server.js';

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
    app.log.info(`Kite Connect Sandbox running at http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

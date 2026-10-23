import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './utils/logger.js';

const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));

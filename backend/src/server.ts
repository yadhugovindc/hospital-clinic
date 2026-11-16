import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { logger } from './shared/logging/logger.js';

async function main(): Promise<void> {
  await connectDatabase();
  logger.info(`Environment: ${env.NODE_ENV}`);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = (): void => {
    logger.info('Shutting down...');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

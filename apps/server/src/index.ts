import 'dotenv/config';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { connectRedis, disconnectRedis } from './redis/client.js';

const app = createApp(env);
const port = Number(env.PORT);

async function start() {
  await connectDb(env.MONGO_URI);
  await connectRedis(env.REDIS_URL);

  const server = app.listen(port, () => {
    console.info(`API server listening on http://localhost:${port.toString()}`);
    console.info(`    NODE_ENV: ${env.NODE_ENV}`);
    console.info(`    CORS origin: ${env.CLIENT_ORIGIN}`);
  });

  // Graceful shutdown — let in-flight requests drain before exit
  const closeDependencies = async () => {
    try {
      console.info('HTTP server closed');
      await disconnectDb();
      await disconnectRedis();
      process.exit(0);
    } catch (error) {
      console.error('Graceful shutdown failed:', error);
      process.exit(1);
    }
  };

  const shutdown = () => {
    console.info('Shutting down gracefully...');
    server.close(() => {
      void closeDependencies();
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Crash on unhandled rejection in development; log in production (AGENTS.md §5)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  if (env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

import 'dotenv/config';

import { createApp } from './app.js';
import { env } from './config/env.js';

/**
 * Process entry point.
 *
 * Environment is validated by importing env.ts first (it exits on failure).
 * Then the Express app is created and bound to the configured port.
 */
const app = createApp(env);
const port = Number(env.PORT);

const server = app.listen(port, () => {
  console.info(`✅  API server listening on http://localhost:${port.toString()}`);
  console.info(`    NODE_ENV: ${env.NODE_ENV}`);
  console.info(`    CORS origin: ${env.CLIENT_ORIGIN}`);
});

// Graceful shutdown — let in-flight requests drain before exit
process.on('SIGTERM', () => {
  console.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.info('SIGINT received — shutting down gracefully');
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
});

// Crash on unhandled rejection in development; log in production (AGENTS.md §5)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  if (env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

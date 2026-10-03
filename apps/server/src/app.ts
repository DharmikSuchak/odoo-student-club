import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { json, urlencoded } from 'express';
import helmet from 'helmet';

import type { Env } from './config/env.js';
import { announcementRouter } from './features/announcements/announcement.router.js';
import { authRouter } from './features/auth/auth.router.js';
import { dashboardRouter } from './features/dashboard/dashboard.router.js';
import { expenseRouter } from './features/expenses/expense.router.js';
import { membershipRouter } from './features/memberships/membership.router.js';
import { storeRouter } from './features/store/store.router.js';
import { taskRouter } from './features/tasks/task.router.js';
import { globalErrorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';

/**
 * Creates and configures the Express application.
 *
 * Separated from index.ts so the app can be imported in tests without
 * binding to a port.
 *
 * @param env Validated environment variables.
 * @returns Configured Express application.
 */
export function createApp(env: Env) {
  const app = express();

  // ── Security headers (AGENTS.md §9) ────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true, // Required for HTTP-only cookies
    }),
  );

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // ── Cookie parsing (HTTP-only auth cookies) ────────────────────────────────
  // Sign cookies when COOKIE_SECRET is available (optional in dev)
  app.use(cookieParser(env.COOKIE_SECRET));

  if (env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/announcements', announcementRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/expenses', expenseRouter);
  app.use('/api/memberships', membershipRouter);
  app.use('/api/store', storeRouter);
  app.use('/api/tasks', taskRouter);

  app.use((_req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found.' });
  });

  // ── Global error handler (must be last) ────────────────────────────────────
  app.use(globalErrorHandler);

  return app;
}

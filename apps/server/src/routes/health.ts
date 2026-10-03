import { Router } from 'express';
import type { Request, Response } from 'express';

const healthRouter = Router();

/**
 * GET /api/health
 *
 * Returns 200 with the server's current status, uptime, and timestamp.
 * No authentication required. Used by the frontend to verify API reachability.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'unknown',
  });
});

export { healthRouter };

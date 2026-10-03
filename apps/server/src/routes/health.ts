import { Router } from 'express';
import type { Request, Response } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'unknown',
  });
});

export { healthRouter };

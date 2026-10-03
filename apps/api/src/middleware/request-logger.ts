import type { Request, Response, NextFunction } from 'express';

/**
 * Lightweight request logger for development.
 * Logs method, path, status, and duration after the response is sent.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](`${req.method} ${req.path} ${res.statusCode} (${durationMs}ms)`);
  });

  next();
}

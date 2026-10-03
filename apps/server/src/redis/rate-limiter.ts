import type { Request, Response, NextFunction } from 'express';

import { getRedis } from './client.js';
import { AppError } from '../middleware/error-handler.js';

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Redis key prefix — e.g. `rl:login` or `rl:register`. */
  keyPrefix: string;
}

/**
 * Creates an Express middleware that enforces a sliding-window rate limit
 * using Redis INCR + EXPIRE.
 *
 * @param options  Rate limiter configuration.
 * @returns Express middleware that returns 429 when the limit is exceeded.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowSeconds, keyPrefix } = options;

  return async function rateLimiterMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const ip = req.ip ?? 'unknown';
    const key = `${keyPrefix}:${ip}`;

    try {
      const redis = getRedis();
      const count = await redis.incr(key);

      // Set TTL only on the first request in the window.
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        const ttl = await redis.ttl(key);
        throw new AppError(`Too many requests. Try again in ${ttl.toString()} seconds.`, 429);
      }

      next();
    } catch (err) {
      // If the error is already an AppError (rate limit exceeded), pass it on.
      if (err instanceof AppError) {
        next(err);
        return;
      }
      // Redis connectivity errors — fail open to avoid blocking all users
      // during a Redis outage. Log the issue but allow the request.
      console.error('[rate-limiter] Redis error, failing open:', err);
      next();
    }
  };
}

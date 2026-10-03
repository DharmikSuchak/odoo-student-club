import { Router } from 'express';
import type { CookieOptions, NextFunction, Request, Response } from 'express';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { loginBodySchema, registerBodySchema } from '../../db/schemas/user.schema.js';
import { requireAuth, signJwt } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { createRateLimiter } from '../../redis/rate-limiter.js';

import { findSafeUserById, registerUser, validateCredentials } from './auth.service.js';

export const authRouter = Router();

const registerRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
  keyPrefix: 'rl:register',
});

const loginRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
  keyPrefix: 'rl:login',
});

/**
 * Returns cookie options appropriate for the current environment.
 * - `httpOnly: true` — JS cannot access the cookie.
 * - `secure: true` in production — HTTPS only.
 * - `sameSite: 'lax'` — CSRF protection for cross-site navigations.
 *
 * @param maxAgeMs  Cookie max-age in milliseconds.
 * @returns Express cookie options.
 */
function cookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

/** Public endpoint; limited to 10 requests per IP each minute. */
authRouter.post(
  '/register',
  registerRateLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const parsed = registerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
        return;
      }

      try {
        const users = getDb().collection('users');
        const user = await registerUser(users, parsed.data);

        const token = signJwt({
          userId: (user._id as { toString(): string }).toString(),
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        });

        // 7-day max-age (matches JWT_EXPIRES_IN default)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        res.cookie('access_token', token, cookieOptions(sevenDaysMs));

        res.status(201).json({
          status: 'ok',
          user: {
            id: (user._id as { toString(): string }).toString(),
            email: user.email,
            displayName: user.displayName,
            role: user.role,
          },
        });
      } catch (err) {
        next(err);
      }
    })();
  },
);

/** Public endpoint; limited to 10 requests per IP each minute. */
authRouter.post('/login', loginRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
      return;
    }

    try {
      const users = getDb().collection('users');
      const user = await validateCredentials(users, parsed.data);

      const token = signJwt({
        userId: (user._id as { toString(): string }).toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      res.cookie('access_token', token, cookieOptions(sevenDaysMs));

      res.status(200).json({
        status: 'ok',
        user: {
          id: (user._id as { toString(): string }).toString(),
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  })();
});

/** Authentication optional; clearing a missing cookie is harmless. */
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(200).json({ status: 'ok', message: 'Signed out successfully.' });
});

/** Authentication required; all authenticated roles may view their own safe profile. */
authRouter.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const users = getDb().collection('users');
      // req.user is guaranteed non-null here because requireAuth ran — confirmed above.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const authUser = req.user!;
      const user = await findSafeUserById(users, authUser.userId);

      if (user === null) {
        next(new AppError('User not found.', 404));
        return;
      }

      res.status(200).json({
        status: 'ok',
        user: {
          id: (user._id as { toString(): string }).toString(),
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  })();
});

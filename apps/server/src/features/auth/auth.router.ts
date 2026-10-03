/**
 * Auth router — POST /api/auth/register, POST /api/auth/login,
 *               POST /api/auth/logout, GET /api/auth/me
 *
 * AGENTS.md §7: all inputs validated via zod.
 * AGENTS.md §10: passwords hashed with bcrypt (handled in auth.service.ts).
 * AGENTS.md §11: role never accepted from the request.
 * AGENTS.md §6: cookie secret and JWT secret come from env vars.
 */
import { Router, type CookieOptions } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { registerBodySchema, loginBodySchema } from '../../db/schemas/user.schema.js';
import { AppError } from '../../middleware/error-handler.js';
import { requireAuth, signJwt } from '../../middleware/auth.js';
import { createRateLimiter } from '../../redis/rate-limiter.js';
import { registerUser, validateCredentials, findSafeUserById } from './auth.service.js';

export const authRouter = Router();

// ── Shared rate limiters ─────────────────────────────────────────────────────

/**
 * 10 registration attempts per IP per 60 seconds.
 */
const registerRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
  keyPrefix: 'rl:register',
});

/**
 * 10 login attempts per IP per 60 seconds.
 */
const loginRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
  keyPrefix: 'rl:login',
});

// ── Cookie configuration helper ──────────────────────────────────────────────

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

// ── POST /api/auth/register ──────────────────────────────────────────────────

/**
 * Register a new member account.
 *
 * Authentication: none (public).
 * Authorization: none.
 * Rate limit: 10 req / 60 s per IP.
 */
authRouter.post(
  '/register',
  registerRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  },
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────

/**
 * Authenticate with email + password; receives an HTTP-only JWT cookie.
 *
 * Authentication: none (public).
 * Authorization: none.
 * Rate limit: 10 req / 60 s per IP.
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
  },
);

// ── POST /api/auth/logout ────────────────────────────────────────────────────

/**
 * Clears the HTTP-only auth cookie.
 *
 * Authentication: optional (clearing an absent cookie is a no-op).
 * Authorization: none.
 */
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(200).json({ status: 'ok', message: 'Signed out successfully.' });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user's safe profile.
 *
 * Authentication: required (JWT cookie).
 * Authorization: any authenticated role.
 */
authRouter.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = getDb().collection('users');
      // req.user is guaranteed non-null here because requireAuth ran — confirmed above.
      const authUser = req.user!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
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
  },
);

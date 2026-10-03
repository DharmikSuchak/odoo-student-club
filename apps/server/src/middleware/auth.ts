import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from './error-handler.js';
import type { UserRole } from '../db/schemas/user.schema.js';

/**
 * Shape attached to `req.user` after successful authentication.
 * Never includes `passwordHash` or other sensitive fields.
 */
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

/**
 * JWT payload structure.
 * The `sub` field holds the MongoDB `_id` string.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Augment Express Request to carry the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Signs a JWT containing safe user fields.
 *
 * @param user  Safe user fields to embed in the token.
 * @returns Signed JWT string.
 */
export function signJwt(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}

/**
 * Express middleware that verifies the JWT from the `access_token` HTTP-only cookie.
 *
 * On success, populates `req.user` with safe user fields.
 * On failure, passes an AppError(401) to the next error handler.
 *
 * @param req   Express request.
 * @param _res  Express response (unused).
 * @param next  Express next function.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.['access_token'];

  if (typeof token !== 'string' || token.length === 0) {
    next(new AppError('Authentication required.', 401));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    next(new AppError('Invalid or expired token.', 401));
    return;
  }

  req.user = {
    userId: payload.sub,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
  };

  next();
}

/**
 * Creates a middleware that requires the authenticated user to have at least one
 * of the specified roles.
 *
 * Must be used **after** {@link requireAuth}.
 *
 * @param roles  Permitted roles. The check passes if the user's role matches any.
 * @returns Express middleware that returns 403 if the role requirement is not met.
 */
export function requireRole(...roles: UserRole[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    const user = req.user;
    if (user === undefined) {
      // requireAuth was not applied before this middleware — programming error.
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (!roles.includes(user.role)) {
      next(new AppError('You do not have permission to perform this action.', 403));
      return;
    }

    next();
  };
}

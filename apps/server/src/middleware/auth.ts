import type { NextFunction, Request, Response } from 'express';
import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';

import { env } from '../config/env.js';
import type { UserRole } from '../db/schemas/user.schema.js';

import { AppError } from './error-handler.js';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signJwt(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  // @ts-expect-error - exactOptionalPropertyTypes conflict with string | number | undefined
  return jwtSign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token: unknown = req.cookies?.['access_token'];

  if (typeof token !== 'string' || token.length === 0) {
    next(new AppError('Authentication required.', 401));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwtVerify(token, env.JWT_SECRET) as JwtPayload;
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

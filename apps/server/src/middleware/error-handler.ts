import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, AppError);
  }
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    if (!err.isOperational) {
      console.error('[unhandled AppError]', err);
    }
    return;
  }

  // Unknown / programming error — log full context, return generic 500
  console.error('[unexpected error]', err);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred.',
  });
}

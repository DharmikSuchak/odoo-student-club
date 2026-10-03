import type { Request, Response, NextFunction } from 'express';

/**
 * Discriminated-union error type for the API.
 *
 * Operational errors (expected, user-facing) vs. programming errors
 * (unexpected, 500) are distinguished so that the error handler can
 * decide how much detail to expose.
 *
 * See AGENTS.md §5 (Error Handling).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  /**
   * @param message   Human-readable error description.
   * @param statusCode HTTP status code to return to the client.
   * @param isOperational Set to true for expected errors (4xx). Set to false
   *   for programming faults that should trigger a 500.
   */
  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, AppError);
  }
}

/**
 * Express error-handling middleware. Must be registered last.
 *
 * Returns a structured JSON body. Never exposes internal stack traces
 * to the client in production.
 */
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

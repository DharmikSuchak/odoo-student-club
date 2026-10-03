/**
 * Shared primitive types for collection schemas.
 *
 * Using Zod with MongoDB ObjectId: we keep IDs as strings in Zod
 * schemas (they arrive as strings from JSON) and convert to ObjectId
 * in the model layer before writing to MongoDB.
 */
import { z } from 'zod';

/**
 * Money values are always stored as **integer minor units** (e.g. cents for USD,
 * paise for INR). This eliminates floating-point rounding errors.
 *
 * Rule: `amountCents: number` is the field name convention throughout all
 * schemas. Never store `5.00`; always store `500`.
 */
export const moneySchema = z
  .number()
  .int('Money must be an integer (minor units)')
  .nonnegative('Money cannot be negative');

/** 24-hex-character MongoDB ObjectId string */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Must be a 24-character hexadecimal ObjectId');

/**
 * Accepts ISO 8601 strings (e.g. from JSON) and coerces to Date.
 * Use `z.date()` for values already stored as native Dates in MongoDB.
 */
export const isoDateSchema = z.coerce.date();

export const nonEmptyString = z.string().trim().min(1, 'Must not be empty');

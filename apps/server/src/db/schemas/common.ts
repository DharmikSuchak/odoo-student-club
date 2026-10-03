import { z } from 'zod';

export const moneySchema = z
  .number()
  .int('Money must be an integer (minor units)')
  .nonnegative('Money cannot be negative');

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'Must be a 24-character hexadecimal ObjectId');

export const isoDateSchema = z.coerce.date();

export const nonEmptyString = z.string().trim().min(1, 'Must not be empty');

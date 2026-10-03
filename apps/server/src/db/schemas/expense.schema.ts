/**
 * Zod schema for the `expenses` collection.
 *
 * This represents the treasurer's ledger for outgoing club funds (reimbursements,
 * vendor payments).
 *
 * Decisions (Prompt 3):
 * - Simple two-step approval workflow is sufficient for MVP (`pending` -> `approved`/`rejected`).
 * - Approved expenses can transition to `reimbursed` once funds are dispersed.
 */
import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'reimbursed'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const expenseDocumentSchema = z.object({
  clubId: objectIdSchema,
  submittedBy: objectIdSchema, // ref: users
  approvedBy: objectIdSchema.optional(), // ref: users (officer/treasurer)
  
  category: nonEmptyString.max(100),
  description: nonEmptyString.max(1000),
  amountCents: moneySchema,
  currency: z.string().length(3).default('USD'),
  
  receiptUrl: z.string().url().optional(),
  
  status: z.enum(EXPENSE_STATUSES).default('pending'),
  
  occurredAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ExpenseDocument = z.infer<typeof expenseDocumentSchema>;

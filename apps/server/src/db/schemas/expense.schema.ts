/**
 * Zod schema for outgoing club expenses and reimbursements.
 *
 * An organizer submits an expense in `pending`. A treasurer records an
 * auditable review decision, and an approved expense can later be marked as
 * reimbursed when money is actually paid out.
 */
import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'reimbursed'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const expenseDocumentSchema = z.object({
  clubId: objectIdSchema,
  submittedBy: objectIdSchema,
  reviewedBy: objectIdSchema.optional(),
  reimbursedBy: objectIdSchema.optional(),

  category: nonEmptyString.max(100),
  amountCents: moneySchema,
  currency: z.string().regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code'),
  receiptReference: nonEmptyString.max(500),

  status: z.enum(EXPENSE_STATUSES).default('pending'),
  reviewedAt: z.date().optional(),
  reimbursedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ExpenseDocument = z.infer<typeof expenseDocumentSchema>;

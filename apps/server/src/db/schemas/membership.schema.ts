/*
 * Membership history is retained for audit. Officers may set a fixed end date
 * to align with club year-end, and only verified or treasurer-recorded payment
 * may transition a membership to active.
 */
import { z } from 'zod';

import { moneySchema, objectIdSchema } from './common.js';

export const membershipTierDocumentSchema = z.object({
  clubId: objectIdSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  durationDays: z.number().int().positive(),
  priceCents: moneySchema,
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MembershipTierDocument = z.infer<typeof membershipTierDocumentSchema>;

export const MEMBERSHIP_STATUSES = ['pending_payment', 'active', 'expired', 'cancelled'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const membershipDocumentSchema = z.object({
  userId: objectIdSchema,
  tierId: objectIdSchema,
  clubId: objectIdSchema,
  status: z.enum(MEMBERSHIP_STATUSES).default('pending_payment'),

  // endDate may override tier duration to align with club year-end.
  startDate: z.date(),
  endDate: z.date(),

  // Payment — populated only after server-side confirmation (AGENTS.md §12)
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),
  amountPaidCents: moneySchema.optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MembershipDocument = z.infer<typeof membershipDocumentSchema>;

export function isMembershipActive(
  membership: Pick<MembershipDocument, 'status' | 'endDate'>,
  asOf: Date = new Date(),
): boolean {
  return membership.status === 'active' && membership.endDate > asOf;
}

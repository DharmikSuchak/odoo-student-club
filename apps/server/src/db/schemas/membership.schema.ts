/**
 * Zod schema for the `memberships` collection.
 *
 * One document per (user, billing cycle). The collection is append-only
 * for audit purposes: expired memberships are never deleted, only updated
 * from `pending_payment` → `active` → `expired`.
 *
 * Key decisions (Prompt 3):
 *
 * MEMBERSHIP EXPIRY — Club Year-End:
 *   Memberships expire at `endDate`. For club year-end expiry, officers set
 *   a fixed `endDate` (e.g. the last day of the academic year) rather than
 *   deriving it from `startDate + durationDays`. The `membershipTiers` schema
 *   stores `durationDays` as a *default* only; officers may override `endDate`
 *   when creating a membership (e.g. to align with the fiscal year).
 *
 * PAYMENT INTEGRITY:
 *   `status` only transitions to `active` after a confirmed payment.
 *   Payment data is written via server-side webhook or treasurer manual entry.
 *   The client may NOT send `status: 'active'` directly.
 */
import { z } from 'zod';

import { moneySchema, objectIdSchema } from './common.js';

// ── Membership Tier ────────────────────────────────────────────────────────────
/**
 * Club-defined membership products (e.g. "General Member – ₹500/year").
 * A tier is a *template*; each actual purchase creates a `membership` document.
 */
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

// ── Membership status ──────────────────────────────────────────────────────────
export const MEMBERSHIP_STATUSES = [
  'pending_payment',
  'active',
  'expired',
  'cancelled',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

// ── Membership Document ────────────────────────────────────────────────────────
export const membershipDocumentSchema = z.object({
  userId: objectIdSchema,
  tierId: objectIdSchema,
  clubId: objectIdSchema,
  status: z.enum(MEMBERSHIP_STATUSES).default('pending_payment'),

  // Dates: endDate is set explicitly to support club year-end cutoffs
  startDate: z.date(),
  endDate: z.date(), // may be < startDate + durationDays if year-end override

  // Payment — populated only after server-side confirmation (AGENTS.md §12)
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),
  amountPaidCents: moneySchema.optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MembershipDocument = z.infer<typeof membershipDocumentSchema>;

/**
 * Guard: returns true if the membership is currently active and not expired.
 *
 * @param membership  A membership document from the database.
 * @param asOf        The reference date (defaults to now). Useful for testing.
 * @returns `true` if the membership is active and endDate is in the future.
 */
export function isMembershipActive(
  membership: Pick<MembershipDocument, 'status' | 'endDate'>,
  asOf: Date = new Date(),
): boolean {
  return membership.status === 'active' && membership.endDate > asOf;
}

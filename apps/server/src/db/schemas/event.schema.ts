/**
 * Zod schemas for the `events` and `eventTickets` collections.
 *
 * Key decisions (Prompt 3):
 *
 * MEMBER vs. NON-MEMBER TICKET PRICING:
 *   Events may define two prices on the event itself:
 *   - `memberPriceCents`    — price for users with an active membership
 *   - `nonMemberPriceCents` — price for all other registered users
 *   If both are undefined the event has no paid tickets (free admission).
 *   The server determines which price to apply at registration time by
 *   checking the user's current membership status (see `isMembershipActive`).
 *
 * CHECK-IN:
 *   Each ticket document has a `checkedInAt` timestamp. Officers mark
 *   check-in via `PATCH /api/events/:eventId/tickets/:ticketId/check-in`.
 *   A checked-in ticket cannot be cancelled.
 *
 * CAPACITY & WAITLIST:
 *   Capacity is tracked by counting `eventTickets` with status `confirmed`.
 *   When capacity is reached, new registrations receive status `waitlisted`.
 *   Waitlisted tickets auto-promote when a confirmed ticket is cancelled
 *   (promotion job runs synchronously in the cancel handler for MVP;
 *   a background queue can replace it later).
 *
 * NAMING: Documents are called `tickets` (not `registrations`) to align with
 * the Student Organization PDF terminology.
 */
import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const eventDocumentSchema = z.object({
  clubId: objectIdSchema,
  createdBy: objectIdSchema, // ref: users (officer/admin)
  title: nonEmptyString.max(200),
  description: z.string().max(5000).default(''),
  location: z.string().max(200).optional(),
  startsAt: z.date(),
  endsAt: z.date(),
  isPublished: z.boolean().default(false),

  hasTickets: z.boolean().default(false),
  // undefined → unlimited capacity; 0 is not allowed
  ticketCapacity: z.number().int().positive().optional(),
  registrationDeadline: z.date().optional(),

  // Member vs. non-member pricing (both optional → free event)
  memberPriceCents: moneySchema.optional(),
  nonMemberPriceCents: moneySchema.optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EventDocument = z.infer<typeof eventDocumentSchema>;

export const TICKET_STATUSES = ['pending_payment', 'confirmed', 'waitlisted', 'cancelled'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * One document per ticket purchase.
 *
 * `pricePaidCents` is snapshotted at purchase time so historical reports
 * are not affected by future price changes.
 *
 * `checkedInAt` is set by an officer at the door. A ticket is checked in
 * at most once (idempotent endpoint).
 */
export const eventTicketDocumentSchema = z.object({
  eventId: objectIdSchema,
  userId: objectIdSchema,
  status: z.enum(TICKET_STATUSES).default('pending_payment'),

  // Price snapshotted at purchase time; 0 for free tickets
  pricePaidCents: moneySchema.default(0),
  memberPriceApplied: z.boolean().default(false),

  // Payment — only set after server-side confirmation (AGENTS.md §12)
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),

  checkedInAt: z.date().optional(),
  checkedInBy: objectIdSchema.optional(), // ref: users (officer)

  purchasedAt: z.date(),
  cancelledAt: z.date().optional(),
});

export type EventTicketDocument = z.infer<typeof eventTicketDocumentSchema>;

export const createEventBodySchema = z
  .object({
    title: nonEmptyString.max(200),
    description: z.string().max(5000).optional(),
    location: z.string().max(200).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    hasTickets: z.boolean().optional().default(false),
    ticketCapacity: z.number().int().positive().optional(),
    registrationDeadline: z.coerce.date().optional(),
    memberPriceCents: moneySchema.optional(),
    nonMemberPriceCents: moneySchema.optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export type CreateEventBody = z.infer<typeof createEventBodySchema>;

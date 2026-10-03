/**
 * Zod schemas for the `events` and `eventTickets` collections.
 *
 * Key decisions (Prompt 3):
 *
 * MEMBER vs. NON-MEMBER TICKET PRICING:
 *   Events may define two prices on the event itself:
 *   - `memberPriceCents`    — price for users with an active membership
 *   - `nonMemberPriceCents` — price for all other registered users
 *   A zero price represents free admission; prices are otherwise stored in minor units.
 *   The server determines which price to apply at registration time by
 *   checking the user's current membership status (see `isMembershipActive`).
 *
 * CHECK-IN:
 *   Each ticket document has a `checkedInAt` timestamp. Officers mark
 *   check-in via `PATCH /api/events/:eventId/tickets/:ticketId/check-in`.
 *   A checked-in ticket cannot be cancelled.
 *
 * CAPACITY:
 *   `remainingTicketCount` is decremented with an atomic condition in the same
 *   MongoDB transaction that inserts the ticket document.
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

  hasTickets: z.boolean().default(true),
  ticketCapacity: z.number().int().positive(),
  remainingTicketCount: z.number().int().nonnegative(),
  registrationDeadline: z.date().optional(),
  memberPriceCents: moneySchema,
  nonMemberPriceCents: moneySchema,
  currency: z.string().length(3).default('INR'),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EventDocument = z.infer<typeof eventDocumentSchema>;

export const TICKET_STATUSES = ['pending_payment', 'confirmed', 'waitlisted', 'cancelled'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * One document per ticket purchase.
 *
 * `priceCents` is snapshotted when the ticket is requested so later event
 * changes cannot alter the amount due.
 *
 * `checkedInAt` is set by an officer at the door. A ticket is checked in
 * at most once (idempotent endpoint).
 */
export const eventTicketDocumentSchema = z.object({
  clubId: objectIdSchema,
  eventId: objectIdSchema,
  userId: objectIdSchema,
  status: z.enum(TICKET_STATUSES).default('pending_payment'),

  priceCents: moneySchema.default(0),
  currency: z.string().length(3),
  memberPriceApplied: z.boolean().default(false),

  // Payment — only set after server-side confirmation (AGENTS.md §12)
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),

  checkedInAt: z.date().optional(),
  checkedInBy: objectIdSchema.optional(), // ref: users (officer)

  requestedAt: z.date(),
  cancelledAt: z.date().optional(),
});

export type EventTicketDocument = z.infer<typeof eventTicketDocumentSchema>;

export const createEventBodySchema = z
  .object({
    title: nonEmptyString.max(200),
    description: z.string().max(5000).optional().default(''),
    location: z.string().trim().max(200).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    ticketCapacity: z.number().int().positive(),
    registrationDeadline: z.coerce.date().optional(),
    memberPriceCents: moneySchema,
    nonMemberPriceCents: moneySchema,
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code')
      .transform((value) => value.toUpperCase()),
    isPublished: z.boolean().optional().default(false),
  })
  .strict()
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine(
    (data) => data.registrationDeadline === undefined || data.registrationDeadline < data.startsAt,
    {
      message: 'Registration deadline must be before the event starts',
      path: ['registrationDeadline'],
    },
  );

export type CreateEventBody = z.infer<typeof createEventBodySchema>;

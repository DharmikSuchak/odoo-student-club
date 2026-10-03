/*
 * The server selects the member rate after checking active membership.
 * Capacity is decremented atomically in the transaction that inserts the ticket.
 */
import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const eventDocumentSchema = z.object({
  clubId: objectIdSchema,
  createdBy: objectIdSchema,
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

// Price is snapshotted so later event changes cannot alter the amount due.
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
  checkedInBy: objectIdSchema.optional(),

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

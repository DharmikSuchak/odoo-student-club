/**
 * Zod schema for the `payments` collection.
 *
 * This collection is an immutable ledger of all incoming money (memberships,
 * merchandise orders, paid event tickets).
 *
 * Key decisions (Prompt 3):
 *
 * ONLINE PAYMENTS (Mock for Phase 0/1):
 *   To support both manual cash recording by a treasurer and online payments
 *   (e.g., Stripe, Razorpay) in the future, the provider is an enum.
 *   For the hackathon, a 'mock_online' provider is used to simulate successful
 *   card payments.
 *
 * IDEMPOTENCY:
 *   External payment providers deliver webhooks that can be retried. The
 *   `providerEventId` is stored and indexed uniquely to prevent double-crediting
 *   the same payment event.
 */
import { z } from 'zod';

import { moneySchema, objectIdSchema } from './common.js';

export const PAYMENT_PROVIDERS = ['stripe', 'razorpay', 'manual', 'mock_online'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_ENTITY_TYPES = ['membership', 'order', 'event_ticket'] as const;
export type PaymentEntityType = (typeof PAYMENT_ENTITY_TYPES)[number];

export const paymentDocumentSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),

  /**
   * External event ID from the provider webhook (e.g., Stripe event ID).
   * Used as an idempotency key. Null for manual cash payments.
   */
  providerEventId: z.string().max(200).nullable(),

  /**
   * External reference to the payment intent or charge.
   */
  providerPaymentIntentId: z.string().max(200).nullable(),

  amountCents: moneySchema,
  currency: z.string().length(3).default('USD'),

  status: z.enum(PAYMENT_STATUSES),

  /**
   * The entity this payment is paying for.
   */
  relatedEntity: z.object({
    type: z.enum(PAYMENT_ENTITY_TYPES),
    id: objectIdSchema,
  }),

  /** The user who made the payment */
  paidBy: objectIdSchema,

  /** If manual, the treasurer who recorded the cash payment */
  recordedBy: objectIdSchema.optional(),

  occurredAt: z.date(),
  createdAt: z.date(),
});

export type PaymentDocument = z.infer<typeof paymentDocumentSchema>;

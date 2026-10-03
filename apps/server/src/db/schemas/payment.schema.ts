/*
 * Incoming payments form an immutable ledger. providerEventId is uniquely
 * indexed because provider webhooks can be retried and must not double-credit.
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

  providerEventId: z.string().max(200).nullable(),

  providerPaymentIntentId: z.string().max(200).nullable(),

  amountCents: moneySchema,
  currency: z.string().length(3).default('USD'),

  status: z.enum(PAYMENT_STATUSES),

  relatedEntity: z.object({
    type: z.enum(PAYMENT_ENTITY_TYPES),
    id: objectIdSchema,
  }),

  paidBy: objectIdSchema,

  recordedBy: objectIdSchema.optional(),

  occurredAt: z.date(),
  createdAt: z.date(),
});

export type PaymentDocument = z.infer<typeof paymentDocumentSchema>;

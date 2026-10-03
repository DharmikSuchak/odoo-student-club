import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const merchandiseVariantSchema = z.object({
  size: nonEmptyString.max(20),
  stockQuantity: z.number().int().nonnegative(),
});

export type MerchandiseVariant = z.infer<typeof merchandiseVariantSchema>;

export const merchandiseItemDocumentSchema = z.object({
  clubId: objectIdSchema,
  createdBy: objectIdSchema,
  name: nonEmptyString.max(200),
  priceCents: moneySchema.positive(),
  currency: z.string().length(3),
  imageUrl: z.string().url().optional(),
  variants: z.array(merchandiseVariantSchema).min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MerchandiseItemDocument = z.infer<typeof merchandiseItemDocumentSchema>;

export const ORDER_STATUSES = ['pending_payment', 'paid', 'fulfilled', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderDocumentSchema = z.object({
  userId: objectIdSchema,
  clubId: objectIdSchema,
  itemId: objectIdSchema,
  itemName: nonEmptyString.max(200),
  size: nonEmptyString.max(20),
  quantity: z.literal(1),
  unitPriceCents: moneySchema,
  totalCents: moneySchema,
  currency: z.string().length(3),
  status: z.enum(ORDER_STATUSES).default('pending_payment'),
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrderDocument = z.infer<typeof orderDocumentSchema>;

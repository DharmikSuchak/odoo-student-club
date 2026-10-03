/**
 * Zod schemas for the `merchandiseItems` and `orders` collections.
 *
 * Key decisions (Prompt 3):
 *
 * SIZE-BASED STOCK:
 *   Merchandise items support per-size stock tracking via an optional
 *   `variants` array. Each variant has a `size` label and its own
 *   `stockQuantity`. If `variants` is absent the item is treated as
 *   size-agnostic with a single `stockQuantity` on the item document.
 *   Stock is decremented atomically (using `$inc` + `$gte` query guard)
 *   in the order placement transaction.
 *
 *   `stockQuantity` of -1 means unlimited stock.
 *
 * PAYMENT INTEGRITY:
 *   Order status transitions: `pending_payment` → `paid` → `fulfilled`
 *   or `pending_payment` → `cancelled`.
 *   The client may NEVER directly set `status: 'paid'`. Payment is confirmed
 *   via a verified webhook or a treasurer's manual entry.
 *
 * ORDER LINE ITEMS:
 *   Prices are snapshotted at order creation so historical reports remain
 *   accurate even if the item price changes later.
 */
import { z } from 'zod';

import { moneySchema, nonEmptyString, objectIdSchema } from './common.js';

export const merchandiseVariantSchema = z.object({
  /** Size label: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | or free-form */
  size: nonEmptyString.max(20),
  /** -1 = unlimited; ≥ 0 = finite stock */
  stockQuantity: z.number().int().min(-1),
});

export type MerchandiseVariant = z.infer<typeof merchandiseVariantSchema>;

export const merchandiseItemDocumentSchema = z.object({
  clubId: objectIdSchema,
  name: nonEmptyString.max(200),
  description: z.string().max(2000).optional(),
  priceCents: moneySchema,
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),

  // If variants is present, use variant-level stockQuantity.
  // If absent, use the top-level stockQuantity.
  variants: z.array(merchandiseVariantSchema).min(1).optional(),

  /**
   * Top-level stock (used when `variants` is absent).
   * -1 = unlimited.
   */
  stockQuantity: z.number().int().min(-1).default(0),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MerchandiseItemDocument = z.infer<typeof merchandiseItemDocumentSchema>;

export const orderLineItemSchema = z.object({
  itemId: objectIdSchema,
  /** Size chosen by the buyer; required when the item has variants */
  size: z.string().max(20).optional(),
  quantity: z.number().int().positive(),
  /** Snapshotted at order time — never re-read from the item document */
  unitPriceCents: moneySchema,
});

export type OrderLineItem = z.infer<typeof orderLineItemSchema>;

export const ORDER_STATUSES = ['pending_payment', 'paid', 'fulfilled', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderDocumentSchema = z.object({
  userId: objectIdSchema,
  clubId: objectIdSchema,
  lineItems: z.array(orderLineItemSchema).min(1),
  /** Sum of (quantity × unitPriceCents) across all line items */
  totalCents: moneySchema,
  status: z.enum(ORDER_STATUSES).default('pending_payment'),

  // Payment — only set after server-side confirmation (AGENTS.md §12)
  paymentId: objectIdSchema.optional(),
  paidAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrderDocument = z.infer<typeof orderDocumentSchema>;

export const createOrderBodySchema = z.object({
  lineItems: z
    .array(
      z.object({
        itemId: objectIdSchema,
        size: z.string().max(20).optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'At least one line item is required'),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

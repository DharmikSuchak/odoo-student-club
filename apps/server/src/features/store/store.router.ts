import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { objectIdSchema } from '../../db/schemas/common.js';
import { requireAuth, requireRole, type AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  createProduct,
  getProduct,
  listOrders,
  listProducts,
  placeOrder,
  updateProduct,
} from './store.service.js';

export const storeRouter = Router();

const variantSchema = z
  .object({
    size: z.string().trim().min(1).max(20),
    stockQuantity: z.number().int().nonnegative(),
  })
  .strict();

const productBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    priceCents: z.number().int().positive(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code'),
    variants: z.array(variantSchema).min(1).max(30),
  })
  .strict()
  .superRefine((value, context) => {
    const sizes = value.variants.map((variant) => variant.size.toUpperCase());
    if (new Set(sizes).size !== sizes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Sizes must be unique',
      });
    }
  });

const orderBodySchema = z
  .object({ itemId: objectIdSchema, size: z.string().trim().min(1).max(20) })
  .strict();

function requireUser(request: Request): AuthUser {
  if (request.user === undefined) throw new AppError('Authentication required.', 401);
  return request.user;
}

function getClubId(): string {
  if (env.CLUB_ID.length === 0) throw new AppError('CLUB_ID is not configured.', 500, false);
  return env.CLUB_ID;
}

function getItemId(request: Request): string {
  const itemId = request.params['id'];
  if (itemId === undefined) throw new AppError('Missing product id.', 400);
  return itemId;
}

function sendValidationError(response: Response, error: z.ZodError): void {
  response.status(422).json({
    status: 'error',
    message: 'Validation failed.',
    fields: error.flatten().fieldErrors,
  });
}

/** List store products. Authentication is required. */
storeRouter.get('/products', requireAuth, (_request, response, next) => {
  void (async () => {
    try {
      response.status(200).json({
        status: 'ok',
        products: await listProducts(getDb(), getClubId()),
      });
    } catch (error) {
      next(error);
    }
  })();
});

/** Load a product detail. Authentication is required. */
storeRouter.get('/products/:id', requireAuth, (request, response, next) => {
  void (async () => {
    try {
      response.status(200).json({
        status: 'ok',
        product: await getProduct(getDb(), getClubId(), getItemId(request)),
      });
    } catch (error) {
      next(error);
    }
  })();
});

/** Create a product. Authentication and officer/admin role are required. */
storeRouter.post(
  '/products',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = productBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const product = await createProduct(getDb(), {
          ...parsed.data,
          clubId: getClubId(),
          createdBy: requireUser(request).userId,
        });
        response.status(201).json({ status: 'ok', product });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Edit product details and stock. Authentication and officer/admin role are required. */
storeRouter.patch(
  '/products/:id',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = productBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const product = await updateProduct(getDb(), getClubId(), getItemId(request), parsed.data);
        response.status(200).json({ status: 'ok', product });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Place a one-unit order that reserves stock and remains pending payment. */
storeRouter.post('/orders', requireAuth, (request, response, next) => {
  void (async () => {
    const parsed = orderBodySchema.safeParse(request.body);
    if (!parsed.success) return sendValidationError(response, parsed.error);
    try {
      const order = await placeOrder(getDb(), {
        ...parsed.data,
        clubId: getClubId(),
        userId: requireUser(request).userId,
      });
      response.status(201).json({ status: 'ok', order });
    } catch (error) {
      next(error);
    }
  })();
});

/** List the authenticated member's pending and historical orders. */
storeRouter.get('/orders/mine', requireAuth, (request, response, next) => {
  void (async () => {
    try {
      response.status(200).json({
        status: 'ok',
        orders: await listOrders(getDb(), getClubId(), requireUser(request).userId),
      });
    } catch (error) {
      next(error);
    }
  })();
});

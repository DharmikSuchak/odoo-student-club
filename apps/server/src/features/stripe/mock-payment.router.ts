import { Router, type Request, type Response, type NextFunction } from 'express';
import { ObjectId } from 'mongodb';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import type { MembershipTierDocument, MembershipDocument } from '../../db/schemas/membership.schema.js';
import type { OrderDocument } from '../../db/schemas/merchandise.schema.js';

export const mockPaymentRouter = Router();

mockPaymentRouter.post(
  '/simulate',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { tierId } = req.body;
        if (!tierId) {
          next(new AppError('tierId is required', 400));
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const authUser = req.user!;
        const db = getDb();

        const tier = await db.collection<MembershipTierDocument>('membershipTiers').findOne({ _id: new ObjectId(tierId) });
        if (!tier) {
          next(new AppError('Tier not found', 404));
          return;
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + tier.durationDays);

        // Check if user already has an active membership
        const existing = await db.collection<MembershipDocument>('memberships').findOne({
          userId: authUser.userId,
          status: 'active',
        });
        
        if (existing) {
          next(new AppError('You already have an active membership.', 400));
          return;
        }

        const insertResult = await db.collection<MembershipDocument>('memberships').insertOne({
          userId: authUser.userId,
          tierId: tierId,
          clubId: env.CLUB_ID,
          status: 'active',
          startDate: startDate,
          endDate: endDate,
          paidAt: new Date(),
          amountPaidCents: tier.priceCents,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.collection('payments').insertOne({
          provider: 'mock',
          providerEventId: null,
          providerPaymentIntentId: null,
          amountCents: tier.priceCents,
          currency: 'INR',
          status: 'succeeded',
          relatedEntity: { type: 'membership', id: insertResult.insertedId.toHexString() },
          paidBy: authUser.userId,
          recordedBy: authUser.userId,
          occurredAt: new Date(),
          createdAt: new Date(),
        });

        res.status(200).json({ status: 'ok' });
      } catch (err) {
        next(err);
      }
    })();
  }
);

mockPaymentRouter.post(
  '/simulate-store',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { orderId } = req.body;
        if (!orderId) {
          next(new AppError('orderId is required', 400));
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const authUser = req.user!;
        const db = getDb();

        const order = await db.collection<OrderDocument>('orders').findOne({ _id: new ObjectId(orderId), userId: authUser.userId });
        if (!order) {
          next(new AppError('Order not found', 404));
          return;
        }

        if (order.status !== 'pending_payment') {
          next(new AppError('Order is not pending payment', 400));
          return;
        }

        await db.collection<OrderDocument>('orders').updateOne(
          { _id: new ObjectId(orderId) },
          { 
            $set: { 
              status: 'paid', 
              paidAt: new Date(),
            } 
          }
        );

        await db.collection('payments').insertOne({
          provider: 'mock',
          providerEventId: null,
          providerPaymentIntentId: null,
          amountCents: order.totalCents,
          currency: 'INR',
          status: 'succeeded',
          relatedEntity: { type: 'order', id: orderId },
          paidBy: authUser.userId,
          recordedBy: authUser.userId,
          occurredAt: new Date(),
          createdAt: new Date(),
        });

        res.status(200).json({ status: 'ok' });
      } catch (err) {
        next(err);
      }
    })();
  }
);

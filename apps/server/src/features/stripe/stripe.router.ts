import { Router, type Request, type Response, type NextFunction } from 'express';
import { raw } from 'express';
import { ObjectId } from 'mongodb';
import StripeClient from 'stripe';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import type { EventTicketDocument, EventDocument } from '../../db/schemas/event.schema.js';
import type { MembershipTierDocument, MembershipDocument } from '../../db/schemas/membership.schema.js';
import type { OrderDocument } from '../../db/schemas/merchandise.schema.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

export const stripeRouter = Router();
export const stripeWebhookRouter = Router();

const stripe = new StripeClient(env.STRIPE_SECRET_KEY ?? 'dummy_key');

// Create checkout session
stripeRouter.post(
  '/checkout',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        if (!env.STRIPE_SECRET_KEY) {
          next(new AppError('Stripe is not configured on this server.', 500));
          return;
        }

        const { tierId } = req.body as { tierId?: string };
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

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: 'inr',
                product_data: {
                  name: tier.name,
                  description: tier.description || `1 Year ${tier.name} Membership`,
                },
                unit_amount: tier.priceCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${env.CLIENT_ORIGIN}/membership?success=true`,
          cancel_url: `${env.CLIENT_ORIGIN}/membership?canceled=true`,
          metadata: {
            userId: authUser.userId,
            tierId: tierId.toString(),
            clubId: env.CLUB_ID,
          },
        });

        res.status(200).json({ status: 'ok', url: session.url });
      } catch (err) {
        next(err);
      }
    })();
  }
);

// Create checkout session for event tickets
stripeRouter.post(
  '/checkout-event',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        if (!env.STRIPE_SECRET_KEY) {
          next(new AppError('Stripe is not configured on this server.', 500));
          return;
        }

        const { ticketId } = req.body as { ticketId?: string };
        if (!ticketId) {
          next(new AppError('ticketId is required', 400));
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const authUser = req.user!;
        const db = getDb();

        const ticket = await db.collection<EventTicketDocument>('eventTickets').findOne({ _id: new ObjectId(ticketId), userId: authUser.userId });
        if (!ticket) {
          next(new AppError('Ticket not found', 404));
          return;
        }
        
        if (ticket.status !== 'pending_payment') {
          next(new AppError('Ticket is not pending payment', 400));
          return;
        }

        const event = await db.collection<EventDocument>('events').findOne({ _id: new ObjectId(ticket.eventId) });
        if (!event) {
          next(new AppError('Event not found', 404));
          return;
        }

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: ticket.currency.toLowerCase(),
                product_data: {
                  name: event.title,
                  description: 'Event Ticket',
                },
                unit_amount: ticket.priceCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${env.CLIENT_ORIGIN}/events/${event._id.toHexString()}/book?success=true`,
          cancel_url: `${env.CLIENT_ORIGIN}/events/${event._id.toHexString()}/book?canceled=true`,
          metadata: {
            userId: authUser.userId,
            ticketId: ticketId.toString(),
            eventId: event._id.toString(),
            clubId: env.CLUB_ID,
          },
        });

        res.status(200).json({ status: 'ok', url: session.url });
      } catch (err) {
        next(err);
      }
    })();
  }
);

// Create checkout session for store orders
stripeRouter.post(
  '/checkout-store',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        if (!env.STRIPE_SECRET_KEY) {
          next(new AppError('Stripe is not configured on this server.', 500));
          return;
        }

        const { orderId } = req.body as { orderId?: string };
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

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: order.currency.toLowerCase(),
                product_data: {
                  name: order.itemName,
                  description: `Size: ${order.size}`,
                },
                unit_amount: order.unitPriceCents,
              },
              quantity: order.quantity,
            },
          ],
          mode: 'payment',
          success_url: `${env.CLIENT_ORIGIN}/merchandise/orders?success=true`,
          cancel_url: `${env.CLIENT_ORIGIN}/merchandise/${order.itemId}?canceled=true`,
          metadata: {
            userId: authUser.userId,
            storeOrderId: orderId.toString(),
            clubId: env.CLUB_ID,
          },
        });

        res.status(200).json({ status: 'ok', url: session.url });
      } catch (err) {
        next(err);
      }
    })();
  }
);

// Handle Stripe webhooks
stripeWebhookRouter.post(
  '/',
  raw({ type: 'application/json' }),
  (req: Request, res: Response) => {
    void (async () => {
      const sig = req.headers['stripe-signature'];
      if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
        res.status(400).send('Webhook Error: Missing signature or secret');
        return;
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body as string | Buffer,
          sig,
          env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        if (session.metadata?.['tierId'] && session.metadata?.['userId']) {
          const db = getDb();
          
          const tier = await db.collection<MembershipTierDocument>('membershipTiers').findOne({ _id: new ObjectId(session.metadata['tierId']) });
          if (tier) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + tier.durationDays);

            await db.collection<MembershipDocument>('memberships').insertOne({
              userId: session.metadata['userId'],
              tierId: session.metadata['tierId'],
              clubId: session.metadata['clubId'] ?? env.CLUB_ID,
              status: 'active',
              startDate: startDate,
              endDate: endDate,
              paidAt: new Date(),
              amountPaidCents: session.amount_total ?? tier.priceCents,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } else if (session.metadata?.['ticketId'] && session.metadata?.['eventId']) {
          const db = getDb();
          await db.collection<EventTicketDocument>('eventTickets').updateOne(
            { _id: new ObjectId(session.metadata['ticketId']) },
            { 
              $set: { 
                status: 'confirmed', 
                paidAt: new Date(),
                // Store Stripe payment intent if needed in the future
              } 
            }
          );
        } else if (session.metadata?.['storeOrderId']) {
          const db = getDb();
          await db.collection<OrderDocument>('orders').updateOne(
            { _id: new ObjectId(session.metadata['storeOrderId']) },
            { 
              $set: { 
                status: 'paid', 
                paidAt: new Date(),
                paymentId: session.payment_intent as string | undefined,
              } 
            }
          );
        }
      }

      res.json({ received: true });
    })();
  }
);

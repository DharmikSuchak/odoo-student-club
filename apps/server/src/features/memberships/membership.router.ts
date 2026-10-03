import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { isoDateSchema, moneySchema, objectIdSchema } from '../../db/schemas/common.js';
import { MEMBERSHIP_STATUSES } from '../../db/schemas/membership.schema.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  createMembership,
  createTier,
  getMembership,
  getMembershipHistory,
  isMembershipActive,
  listActiveTiers,
  listMemberships,
  recordManualPayment,
} from './membership.service.js';

export const membershipRouter = Router();

const createTierBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  durationDays: z.number().int().positive(),
  priceCents: moneySchema,
});

const createMembershipBodySchema = z.object({
  userId: objectIdSchema,
  tierId: objectIdSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

const recordPaymentBodySchema = z.object({
  amountPaidCents: moneySchema,
});

const listQuerySchema = z.object({
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
});

function getClubId(): string {
  const id = env.CLUB_ID;
  if (!id) throw new AppError('CLUB_ID is not configured.', 500, false);
  return id;
}

/** Authentication required; all roles may list active tiers. */
membershipRouter.get('/tiers', requireAuth, (_req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const tiers = getDb().collection('membershipTiers');
      const result = await listActiveTiers(tiers, getClubId());
      res.status(200).json({ status: 'ok', tiers: result });
    } catch (err) {
      next(err);
    }
  })();
});

/** Authentication required; officer, treasurer, or admin may create tiers. */
membershipRouter.post(
  '/tiers',
  requireAuth,
  requireRole('officer', 'treasurer', 'admin'),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createTierBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
        return;
      }
      try {
        const tiers = getDb().collection('membershipTiers');
        const tier = await createTier(tiers, getClubId(), parsed.data);
        res.status(201).json({ status: 'ok', tier });
      } catch (err) {
        next(err);
      }
    })();
  },
);

/** Authentication required; members may view their own current membership. */
membershipRouter.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const memberships = getDb().collection('memberships');
      // req.user is non-null: requireAuth guarantees this
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const authUser = req.user!;
      const membership = await getMembership(memberships, authUser.userId);
      const isActive = membership !== null ? isMembershipActive(membership) : false;
      res.status(200).json({ status: 'ok', membership, isActive });
    } catch (err) {
      next(err);
    }
  })();
});

/** Authentication required; members may view their own membership history. */
membershipRouter.get(
  '/me/history',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const memberships = getDb().collection('memberships');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const authUser = req.user!;
        const history = await getMembershipHistory(memberships, authUser.userId);
        res.status(200).json({ status: 'ok', memberships: history });
      } catch (err) {
        next(err);
      }
    })();
  },
);

/** Authentication required; officer, treasurer, or admin may list memberships. */
membershipRouter.get(
  '/',
  requireAuth,
  requireRole('officer', 'treasurer', 'admin'),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
        return;
      }
      try {
        const memberships = getDb().collection('memberships');
        const list = await listMemberships(memberships, getClubId(), parsed.data);
        res.status(200).json({ status: 'ok', memberships: list });
      } catch (err) {
        next(err);
      }
    })();
  },
);

/** Authentication required; officer, treasurer, or admin may create memberships. */
membershipRouter.post(
  '/',
  requireAuth,
  requireRole('officer', 'treasurer', 'admin'),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createMembershipBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
        return;
      }
      try {
        const memberships = getDb().collection('memberships');
        const tiers = getDb().collection('membershipTiers');
        const membership = await createMembership(memberships, tiers, {
          ...parsed.data,
          clubId: getClubId(),
        });
        res.status(201).json({ status: 'ok', membership });
      } catch (err) {
        next(err);
      }
    })();
  },
);

/** Authentication required; treasurer or admin only. This records received offline funds, not an online payment. */
membershipRouter.post(
  '/:id/record-payment',
  requireAuth,
  requireRole('treasurer', 'admin'),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const membershipId = req.params['id'];
      if (membershipId === undefined || membershipId.length === 0) {
        next(new AppError('Missing membership id.', 400));
        return;
      }

      const parsed = recordPaymentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new AppError(JSON.stringify({ fields: parsed.error.flatten().fieldErrors }), 422));
        return;
      }

      try {
        const memberships = getDb().collection('memberships');
        const payments = getDb().collection('payments');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const authUser = req.user!;
        const updated = await recordManualPayment(memberships, payments, {
          membershipId,
          amountPaidCents: parsed.data.amountPaidCents,
          recordedById: authUser.userId,
        });
        res.status(200).json({ status: 'ok', membership: updated });
      } catch (err) {
        next(err);
      }
    })();
  },
);

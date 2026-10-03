/**
 * Membership router.
 *
 * Routes:
 *   GET  /api/memberships/tiers                 — list active tiers (any auth)
 *   POST /api/memberships/tiers                 — create tier (officer+)
 *   GET  /api/memberships/me                    — own current membership (any auth)
 *   GET  /api/memberships/me/history            — own membership history (any auth)
 *   GET  /api/memberships                       — list all (officer+)
 *   POST /api/memberships                       — create membership (officer+)
 *   POST /api/memberships/:id/record-payment    — record manual payment (treasurer+)
 *
 * AGENTS.md §7: every input validated via zod.
 * AGENTS.md §11: officer+ role required for create; treasurer+ for payment.
 * AGENTS.md §12: manual payment clearly NOT a real online payment.
 * AGENTS.md §6: CLUB_ID comes from env (not from request body).
 */
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

// ── Validation schemas ────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the club ID from the environment (single-club Phase 1). */
function getClubId(): string {
  const id = env.CLUB_ID;
  if (!id) throw new AppError('CLUB_ID is not configured.', 500, false);
  return id;
}

// ── GET /api/memberships/tiers ────────────────────────────────────────────────

/**
 * List all active tiers for the club.
 * Authentication: required. Authorization: any role.
 */
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

// ── POST /api/memberships/tiers ───────────────────────────────────────────────

/**
 * Create a new membership tier.
 * Authentication: required. Authorization: officer, treasurer, admin.
 */
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

// ── GET /api/memberships/me ───────────────────────────────────────────────────

/**
 * Get the current user's latest membership.
 * Authentication: required. Authorization: any role.
 */
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

// ── GET /api/memberships/me/history ──────────────────────────────────────────

/**
 * Get the current user's full membership history.
 * Authentication: required. Authorization: any role.
 */
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

// ── GET /api/memberships ──────────────────────────────────────────────────────

/**
 * List all memberships for the club (paginated; organizer view).
 * Authentication: required. Authorization: officer, treasurer, admin.
 */
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

// ── POST /api/memberships ─────────────────────────────────────────────────────

/**
 * Create a new membership for a user (pending_payment status).
 * Authentication: required. Authorization: officer, treasurer, admin.
 */
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

// ── POST /api/memberships/:id/record-payment ──────────────────────────────────

/**
 * Record a manual (cash/offline) payment and activate the membership.
 *
 * ⚠️  This is NOT an online payment. It records that a treasurer physically
 *     accepted cash or a bank transfer. The UI must present this clearly.
 *
 * Authentication: required. Authorization: treasurer, admin only.
 */
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

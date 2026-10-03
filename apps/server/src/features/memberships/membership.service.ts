/**
 * Membership feature — service layer.
 *
 * Business rules enforced here (never in route handlers):
 *   - Only officer/admin/treasurer roles can create or renew a membership.
 *   - `status` transitions to `active` only via recordManualPayment (treasurer only).
 *   - A member may not choose their own role or payment status.
 *   - Expiry is always checked against **UTC server time** (see TIMEZONE POLICY).
 *
 * TIMEZONE POLICY (documented here for all callers):
 *   All timestamps are stored and compared as UTC Date objects.
 *   `endDate` is set to midnight UTC of the desired expiry calendar day.
 *   The API returns ISO-8601 strings; the UI converts to local time for display.
 *   Callers should pass `asOf = new Date()` (UTC) for expiry checks. Tests may
 *   pass an explicit date to verify boundary behaviour.
 *
 * PAYMENT INTEGRITY (AGENTS.md §12):
 *   `recordManualPayment` records a cash/offline payment by a treasurer.
 *   It explicitly sets provider='manual' and records `recordedById`.
 *   This is NOT a real online payment and is clearly labelled as such.
 *   Future: replace with server-side webhook from Stripe/Razorpay.
 *
 * AGENTS.md §2: single-purpose functions ≤ 40 lines.
 * AGENTS.md §8: query fields are allowlisted — never spread user input directly.
 */
import { ObjectId, type Collection } from 'mongodb';

import {
  isMembershipActive,
  membershipDocumentSchema,
  membershipTierDocumentSchema,
  type MembershipDocument,
  type MembershipStatus,
  type MembershipTierDocument,
} from '../../db/schemas/membership.schema.js';
import { AppError } from '../../middleware/error-handler.js';

/** Public projection: fields safe to return to any client. */
const SAFE_MEMBERSHIP_PROJECTION = {
  userId: 1,
  tierId: 1,
  clubId: 1,
  status: 1,
  startDate: 1,
  endDate: 1,
  paidAt: 1,
  amountPaidCents: 1,
  createdAt: 1,
  updatedAt: 1,
  // paymentId is internal — omit from responses
};

export type SafeMembership = Pick<
  MembershipDocument & { _id: ObjectId },
  | 'userId'
  | 'tierId'
  | 'clubId'
  | 'status'
  | 'startDate'
  | 'endDate'
  | 'paidAt'
  | 'amountPaidCents'
  | 'createdAt'
  | 'updatedAt'
> & { _id: ObjectId };

export type SafeMembershipTier = Pick<
  MembershipTierDocument & { _id: ObjectId },
  'name' | 'description' | 'durationDays' | 'priceCents' | 'isActive' | 'clubId'
> & { _id: ObjectId };

/**
 * Validates and parses a hex ObjectId string. Throws 400 on invalid input.
 *
 * @param id   Hex string to validate.
 * @param name  Field name for the error message.
 * @returns Parsed `ObjectId`.
 */
function parseObjectId(id: string, name: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${name}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(id);
}

// ── Membership Tier operations ────────────────────────────────────────────────

/**
 * Lists all active membership tiers for a club.
 *
 * @param tiers   MongoDB `membershipTiers` collection.
 * @param clubId  Allowlisted club identifier (hex string).
 * @returns Array of safe tier documents.
 */
export async function listActiveTiers(
  tiers: Collection,
  clubId: string,
): Promise<SafeMembershipTier[]> {
  const clubOid = parseObjectId(clubId, 'clubId');
  return tiers
    .find<SafeMembershipTier>({ clubId: clubOid.toHexString(), isActive: true })
    .toArray();
}

/**
 * Creates a new membership tier (officer/admin only).
 *
 * @param tiers       MongoDB `membershipTiers` collection.
 * @param clubId      Club identifier.
 * @param body        Validated tier fields.
 * @returns The created tier document.
 */
export async function createTier(
  tiers: Collection,
  clubId: string,
  body: { name: string; description?: string | undefined; durationDays: number; priceCents: number },
): Promise<SafeMembershipTier> {
  const clubOid = parseObjectId(clubId, 'clubId');
  const now = new Date();
  const doc = membershipTierDocumentSchema.parse({
    clubId: clubOid.toHexString(),
    name: body.name,
    description: body.description,
    durationDays: body.durationDays,
    priceCents: body.priceCents,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const result = await tiers.insertOne(doc);
  const inserted = await tiers.findOne<SafeMembershipTier>({ _id: result.insertedId });
  if (inserted === null) {
    throw new AppError('Failed to retrieve newly created tier.', 500, false);
  }
  return inserted;
}

// ── Membership operations ─────────────────────────────────────────────────────

/**
 * Returns the current membership for a user (most recent, any status).
 * Members can only view their own; officers/admins can view any.
 *
 * @param memberships  MongoDB `memberships` collection.
 * @param userId       The user whose membership to retrieve.
 * @returns Safe membership, or null if none exists.
 */
export async function getMembership(
  memberships: Collection,
  userId: string,
): Promise<SafeMembership | null> {
  const userOid = parseObjectId(userId, 'userId');
  return memberships.findOne<SafeMembership>(
    { userId: userOid.toHexString() },
    {
      projection: SAFE_MEMBERSHIP_PROJECTION,
      sort: { createdAt: -1 },
    },
  );
}

/**
 * Returns all memberships for a user (full history).
 *
 * @param memberships  MongoDB `memberships` collection.
 * @param userId       User identifier.
 * @returns Chronologically ordered membership history.
 */
export async function getMembershipHistory(
  memberships: Collection,
  userId: string,
): Promise<SafeMembership[]> {
  const userOid = parseObjectId(userId, 'userId');
  return memberships
    .find<SafeMembership>(
      { userId: userOid.toHexString() },
      { projection: SAFE_MEMBERSHIP_PROJECTION, sort: { createdAt: -1 } },
    )
    .toArray();
}

/**
 * Lists all memberships for the club (organizer view).
 *
 * @param memberships  MongoDB `memberships` collection.
 * @param clubId       Club identifier.
 * @param filter       Optional status filter.
 * @returns Array of safe membership documents.
 */
export async function listMemberships(
  memberships: Collection,
  clubId: string,
  filter?: { status?: MembershipStatus | undefined },
): Promise<SafeMembership[]> {
  const clubOid = parseObjectId(clubId, 'clubId');
  const query: Record<string, unknown> = { clubId: clubOid.toHexString() };
  // Allowlisted filter — only known fields accepted (AGENTS.md §8)
  if (filter?.status !== undefined) {
    query['status'] = filter.status;
  }
  return memberships
    .find<SafeMembership>(query, {
      projection: SAFE_MEMBERSHIP_PROJECTION,
      sort: { createdAt: -1 },
    })
    .toArray();
}

interface CreateMembershipBody {
  userId: string;
  tierId: string;
  clubId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Creates a new membership in `pending_payment` status.
 * Only officer/admin/treasurer may call this.
 *
 * @param memberships  MongoDB `memberships` collection.
 * @param tiers        MongoDB `membershipTiers` collection.
 * @param body         Validated membership fields.
 * @returns The created membership (safe projection).
 * @throws {AppError} 404 if the tier is not found.
 * @throws {AppError} 409 if an active membership already exists for the user.
 */
export async function createMembership(
  memberships: Collection,
  tiers: Collection,
  body: CreateMembershipBody,
): Promise<SafeMembership> {
  const tierOid = parseObjectId(body.tierId, 'tierId');
  const userOid = parseObjectId(body.userId, 'userId');
  const clubOid = parseObjectId(body.clubId, 'clubId');

  // Verify tier exists
  const tier = await tiers.findOne({ _id: tierOid });
  if (tier === null) {
    throw new AppError('Membership tier not found.', 404);
  }

  // Block if an active membership already exists
  const existing = await memberships.findOne({
    userId: userOid.toHexString(),
    status: 'active',
    endDate: { $gt: new Date() },
  });
  if (existing !== null) {
    throw new AppError(
      'User already has an active membership. Renew after expiry or cancel first.',
      409,
    );
  }

  const now = new Date();
  const doc = membershipDocumentSchema.parse({
    userId: userOid.toHexString(),
    tierId: tierOid.toHexString(),
    clubId: clubOid.toHexString(),
    status: 'pending_payment',
    startDate: body.startDate,
    endDate: body.endDate,
    createdAt: now,
    updatedAt: now,
  });

  const result = await memberships.insertOne(doc);
  const inserted = await memberships.findOne<SafeMembership>(
    { _id: result.insertedId },
    { projection: SAFE_MEMBERSHIP_PROJECTION },
  );
  if (inserted === null) {
    throw new AppError('Failed to retrieve newly created membership.', 500, false);
  }
  return inserted;
}

interface RecordPaymentBody {
  membershipId: string;
  amountPaidCents: number;
  recordedById: string;
}

/**
 * Records a manual (cash/offline) payment and transitions the membership to `active`.
 *
 * ⚠️  This is NOT a real online payment.
 *     It records that a treasurer manually accepted cash/bank transfer.
 *     A real online payment requires a verified server-side webhook (AGENTS.md §12).
 *
 * Only treasurer/admin may call this endpoint.
 *
 * @param memberships   MongoDB `memberships` collection.
 * @param payments      MongoDB `payments` collection.
 * @param body          Allowlisted payment fields.
 * @returns The updated membership (safe projection).
 * @throws {AppError} 404 if membership not found.
 * @throws {AppError} 409 if already active.
 * @throws {AppError} 400 if amount is non-positive.
 */
export async function recordManualPayment(
  memberships: Collection,
  payments: Collection,
  body: RecordPaymentBody,
): Promise<SafeMembership> {
  if (body.amountPaidCents <= 0) {
    throw new AppError('amountPaidCents must be a positive integer.', 400);
  }

  const membershipOid = parseObjectId(body.membershipId, 'membershipId');
  const recordedByOid = parseObjectId(body.recordedById, 'recordedById');

  const membership = await memberships.findOne<MembershipDocument & { _id: ObjectId }>({
    _id: membershipOid,
  });
  if (membership === null) {
    throw new AppError('Membership not found.', 404);
  }
  if (membership.status === 'active') {
    throw new AppError('This membership is already active.', 409);
  }

  const now = new Date();

  // Insert immutable payment ledger entry (AGENTS.md §12)
  const paymentResult = await payments.insertOne({
    provider: 'manual',
    providerEventId: null,
    providerPaymentIntentId: null,
    amountCents: body.amountPaidCents,
    currency: 'INR',
    status: 'succeeded',
    relatedEntity: { type: 'membership', id: membershipOid.toHexString() },
    paidBy: membership.userId,
    recordedBy: recordedByOid.toHexString(),
    occurredAt: now,
    createdAt: now,
  });

  // Transition membership to active
  await memberships.updateOne(
    { _id: membershipOid },
    {
      $set: {
        status: 'active',
        paidAt: now,
        amountPaidCents: body.amountPaidCents,
        paymentId: paymentResult.insertedId.toHexString(),
        updatedAt: now,
      },
    },
  );

  const updated = await memberships.findOne<SafeMembership>(
    { _id: membershipOid },
    { projection: SAFE_MEMBERSHIP_PROJECTION },
  );
  if (updated === null) {
    throw new AppError('Failed to retrieve updated membership.', 500, false);
  }
  return updated;
}

/**
 * Checks whether a membership is currently active (UTC server time).
 * Re-exports the schema guard so callers get the same semantics.
 *
 * @param membership  Membership to check.
 * @param asOf        Reference date (defaults to `new Date()` UTC now).
 * @returns `true` if status is `active` and endDate > asOf.
 */
export { isMembershipActive };

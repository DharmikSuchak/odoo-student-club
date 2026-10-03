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

function parseObjectId(id: string, name: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${name}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(id);
}

export async function listActiveTiers(
  tiers: Collection,
  clubId: string,
): Promise<SafeMembershipTier[]> {
  const clubOid = parseObjectId(clubId, 'clubId');
  return tiers
    .find<SafeMembershipTier>({ clubId: clubOid.toHexString(), isActive: true })
    .toArray();
}

export async function createTier(
  tiers: Collection,
  clubId: string,
  body: {
    name: string;
    description?: string | undefined;
    durationDays: number;
    priceCents: number;
  },
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

export async function createMembership(
  memberships: Collection,
  tiers: Collection,
  body: CreateMembershipBody,
): Promise<SafeMembership> {
  const tierOid = parseObjectId(body.tierId, 'tierId');
  const userOid = parseObjectId(body.userId, 'userId');
  const clubOid = parseObjectId(body.clubId, 'clubId');

  const tier = await tiers.findOne({ _id: tierOid });
  if (tier === null) {
    throw new AppError('Membership tier not found.', 404);
  }

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

// This records treasurer-confirmed offline payment; online payment requires server verification.
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

export { isMembershipActive };

export async function sendRenewalReminders(memberships: Collection, clubId: string): Promise<{ sentCount: number }> {
  const clubOid = parseObjectId(clubId, 'clubId');
  const now = new Date();
  
  // Find members whose membership expires within the next 30 days and is currently active
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const expiringMemberships = await memberships.find({
    clubId: clubOid.toHexString(),
    status: 'active',
    endDate: { $gt: now, $lte: thirtyDaysFromNow }
  }).toArray();
  
  // In a real application, we would map through these and send an email or push notification to the user.
  // For this local platform, we just simulate the operation and return the count.
  return { sentCount: expiringMemberships.length };
}

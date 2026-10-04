import { ObjectId, type Collection } from 'mongodb';

import { AppError } from '../../middleware/error-handler.js';

export interface TierBreakdown {
  tierName: string;
  count: number;
}

export interface DashboardSummary {
  activeMembers: number;
  upcomingEvents: number;
  openTasks: number;
  pendingDues: number;
  tierBreakdown: TierBreakdown[];
}

function parseClubId(clubId: string): string {
  if (!ObjectId.isValid(clubId)) {
    throw new AppError('Invalid clubId: must be a 24-character hex string.', 500, false);
  }
  return new ObjectId(clubId).toHexString();
}

export async function getDashboardSummary(
  memberships: Collection,
  events: Collection,
  tasks: Collection,
  membershipTiers: Collection,
  clubId: string,
  asOf: Date = new Date(),
): Promise<DashboardSummary> {
  const scopedClubId = parseClubId(clubId);
  const [upcomingEvents, openTasks, pendingDues] = await Promise.all([
    events.countDocuments({
      clubId: scopedClubId,
      isPublished: true,
      startsAt: { $gt: asOf },
    }),
    tasks.countDocuments({
      clubId: scopedClubId,
      status: { $in: ['not_started', 'in_progress'] },
    }),
    memberships.countDocuments({ clubId: scopedClubId, status: 'pending_payment' }),
  ]);

  const activeMemberships = await memberships
    .find({
      clubId: scopedClubId,
      status: 'active',
      endDate: { $gt: asOf },
    })
    .toArray();

  const tierCounts = new Map<string, number>();
  for (const m of activeMemberships) {
    if (m.tierId) {
      const tierId = typeof m.tierId === 'string' ? m.tierId : (m.tierId as ObjectId).toHexString();
      tierCounts.set(tierId, (tierCounts.get(tierId) || 0) + 1);
    }
  }

  const tierBreakdown: TierBreakdown[] = [];
  if (tierCounts.size > 0) {
    const tierIds = Array.from(tierCounts.keys()).map((id) => new ObjectId(id));
    const tiers = await membershipTiers
      .find({ _id: { $in: tierIds } })
      .project({ _id: 1, name: 1 })
      .toArray();

    const tierMap = new Map(tiers.map((t) => [(t._id as ObjectId).toHexString(), t.name as string]));

    for (const [tierId, count] of tierCounts.entries()) {
      tierBreakdown.push({
        tierName: tierMap.get(tierId) || 'Unknown Tier',
        count,
      });
    }
  }

  tierBreakdown.sort((a, b) => b.count - a.count);

  return { 
    activeMembers: activeMemberships.length, 
    upcomingEvents, 
    openTasks, 
    pendingDues,
    tierBreakdown,
  };
}

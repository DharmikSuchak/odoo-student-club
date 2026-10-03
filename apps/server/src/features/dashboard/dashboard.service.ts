import { ObjectId, type Collection } from 'mongodb';

import { AppError } from '../../middleware/error-handler.js';

export interface DashboardSummary {
  activeMembers: number;
  upcomingEvents: number;
  openTasks: number;
  pendingDues: number;
}

function parseClubId(clubId: string): string {
  if (!ObjectId.isValid(clubId)) {
    throw new AppError('Invalid clubId: must be a 24-character hex string.', 500, false);
  }
  return new ObjectId(clubId).toHexString();
}

/**
 * Counts the current club records displayed by the dashboard stat cards.
 *
 * @param memberships MongoDB memberships collection.
 * @param events MongoDB events collection.
 * @param tasks MongoDB volunteer tasks collection.
 * @param clubId Current single-club identifier.
 * @param asOf Time boundary used for active memberships and future events.
 * @returns Four live dashboard counts.
 */
export async function getDashboardSummary(
  memberships: Collection,
  events: Collection,
  tasks: Collection,
  clubId: string,
  asOf: Date = new Date(),
): Promise<DashboardSummary> {
  const scopedClubId = parseClubId(clubId);
  const [activeMembers, upcomingEvents, openTasks, pendingDues] = await Promise.all([
    memberships.countDocuments({
      clubId: scopedClubId,
      status: 'active',
      endDate: { $gt: asOf },
    }),
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

  return { activeMembers, upcomingEvents, openTasks, pendingDues };
}

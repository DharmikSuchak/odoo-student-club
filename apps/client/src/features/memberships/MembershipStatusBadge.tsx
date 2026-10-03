/**
 * MembershipStatusBadge — renders a coloured pill for a membership status.
 *
 * @param status  The membership status string.
 */

import type { MembershipStatus } from '../../lib/api-client';

interface MembershipStatusBadgeProps {
  status: MembershipStatus;
  isActive?: boolean;
}

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: 'Active',
  pending_payment: 'Pending Payment',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const STATUS_CLASS: Record<MembershipStatus, string> = {
  active: 'ms-badge--active',
  pending_payment: 'ms-badge--pending',
  expired: 'ms-badge--expired',
  cancelled: 'ms-badge--cancelled',
};

/**
 * Displays a coloured status badge for a membership.
 *
 * @param status    Membership status.
 * @param isActive  Whether the server confirmed the membership is currently active.
 */
export function MembershipStatusBadge({ status, isActive }: MembershipStatusBadgeProps) {
  // A membership may be status='active' but past endDate — treat it as expired visually.
  const effectiveStatus: MembershipStatus =
    status === 'active' && isActive === false ? 'expired' : status;

  return (
    <span className={`ms-badge ${STATUS_CLASS[effectiveStatus]}`} aria-label={`Status: ${STATUS_LABELS[effectiveStatus]}`}>
      {STATUS_LABELS[effectiveStatus]}
    </span>
  );
}

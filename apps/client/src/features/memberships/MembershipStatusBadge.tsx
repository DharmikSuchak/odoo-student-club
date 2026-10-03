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

export function MembershipStatusBadge({ status, isActive }: MembershipStatusBadgeProps) {
  // A membership may be status='active' but past endDate — treat it as expired visually.
  const effectiveStatus: MembershipStatus =
    status === 'active' && isActive === false ? 'expired' : status;

  return (
    <span
      className={`ms-badge ${STATUS_CLASS[effectiveStatus]}`}
      aria-label={`Status: ${STATUS_LABELS[effectiveStatus]}`}
    >
      {STATUS_LABELS[effectiveStatus]}
    </span>
  );
}

/**
 * MyMembershipPage — /membership
 *
 * Member self-service view:
 *   - Shows current membership status and period.
 *   - Shows whether it is currently active (server-verified).
 *   - Empty state with call-to-action when no membership exists.
 *   - Loading skeleton and error state.
 *
 * The page uses real API data — no static success responses.
 */
import { AlertCircle, GraduationCap, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ApiError, Membership, MembershipTier } from '../../lib/api-client';
import { apiGetMyMembership, apiGetTiers } from '../../lib/api-client';

import { MembershipStatusBadge } from './MembershipStatusBadge';
import './membership.css';

/** Formats a UTC ISO date string as a localised date (day/month/year). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // dates are stored as midnight UTC
  });
}

/** Formats an integer minor-unit amount as a human-readable currency string. */
function formatMoney(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

function MembershipSkeleton() {
  return (
    <div className="ms-skeleton" role="status" aria-label="Loading membership">
      <span className="sr-only">Loading membership…</span>
      <div className="ms-skeleton-line ms-skeleton-line--short" />
      <div className="ms-skeleton-line ms-skeleton-line--medium" />
      <div className="ms-skeleton-line ms-skeleton-line--full" />
      <div className="ms-skeleton-line ms-skeleton-line--medium" />
    </div>
  );
}

function MembershipCard({
  membership,
  isActive,
  tier,
}: {
  membership: Membership;
  isActive: boolean;
  tier: MembershipTier | undefined;
}) {
  return (
    <div className="ms-card">
      <div className="ms-card-header">
        <span className="ms-card-title">{tier?.name ?? 'Membership'}</span>
        <MembershipStatusBadge status={membership.status} isActive={isActive} />
      </div>

      {!isActive && membership.status === 'pending_payment' && (
        <div className="ms-notice ms-notice--warning" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>
            Your membership is awaiting payment confirmation. Please contact your club organizer or
            treasurer to record your dues payment.
          </span>
        </div>
      )}

      {!isActive && membership.status === 'active' && (
        <div className="ms-notice ms-notice--warning" role="status">
          <AlertCircle size={18} aria-hidden="true" />
          <span>This membership has expired. Ask an organizer to renew it for you.</span>
        </div>
      )}

      <div className="ms-detail-grid">
        <div className="ms-detail-item">
          <span className="ms-detail-label">Start date</span>
          <span className="ms-detail-value">{formatDate(membership.startDate)}</span>
        </div>
        <div className="ms-detail-item">
          <span className="ms-detail-label">End date</span>
          <span className="ms-detail-value">{formatDate(membership.endDate)}</span>
        </div>
        {tier !== undefined && (
          <div className="ms-detail-item">
            <span className="ms-detail-label">Annual dues</span>
            <span className="ms-detail-value">{formatMoney(tier.priceCents)}</span>
          </div>
        )}
        {membership.amountPaidCents !== undefined && (
          <div className="ms-detail-item">
            <span className="ms-detail-label">Amount paid</span>
            <span className="ms-detail-value">{formatMoney(membership.amountPaidCents)}</span>
          </div>
        )}
        {membership.paidAt !== undefined && (
          <div className="ms-detail-item">
            <span className="ms-detail-label">Paid on</span>
            <span className="ms-detail-value">{formatDate(membership.paidAt)}</span>
          </div>
        )}
      </div>

      {membership.status === 'pending_payment' && (
        <div className="ms-notice ms-notice--info" role="note">
          <Info size={18} aria-hidden="true" />
          <span>
            <strong>Note:</strong> Dues are recorded manually by a treasurer after receiving cash or
            bank transfer. Online payment is not yet available.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Member's self-service membership view.
 * Displays real API data: current membership, status, period, and dues.
 */
export function MyMembershipPage() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const [msRes, tiersRes] = await Promise.all([apiGetMyMembership(), apiGetTiers()]);
        if (!cancelled) {
          setMembership(msRes.membership);
          setIsActive(msRes.isActive);
          setTiers(tiersRes.tiers);
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load membership.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const currentTier = tiers.find((t) => t._id === membership?.tierId);

  return (
    <div className="memberships-page">
      <div className="memberships-heading-row">
        <div>
          <h1 className="memberships-title">My Membership</h1>
          <p className="memberships-subtitle">
            View your current membership status and dues information.
          </p>
        </div>
      </div>

      {isLoading && <MembershipSkeleton />}

      {!isLoading && error !== null && (
        <div className="ms-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{error}</p>
          <button
            type="button"
            className="ms-btn ms-btn--ghost"
            onClick={() => setReloadKey((previous) => previous + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && error === null && membership === null && (
        <div className="ms-empty">
          <span className="ms-empty-icon" aria-hidden="true">
            <GraduationCap size={40} />
          </span>
          <h2 className="ms-empty-title">No membership yet</h2>
          <p className="ms-empty-body">
            You don&apos;t have a membership record. Contact your club organizer to get one set up
            for you.
          </p>

          {tiers.length === 0 && (
            <p className="ms-muted">Membership tiers have not been set up yet.</p>
          )}
          {tiers.length > 0 && (
            <div className="ms-tier-list">
              <p className="ms-detail-label">Available tiers</p>
              {tiers.map((tier) => (
                <div key={tier._id} className="ms-card ms-tier-card">
                  <div className="ms-card-header">
                    <span className="ms-card-title">{tier.name}</span>
                    <span className="ms-detail-value">{formatMoney(tier.priceCents)}</span>
                  </div>
                  {tier.description !== undefined && (
                    <p className="ms-tier-description">{tier.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isLoading && error === null && membership !== null && (
        <MembershipCard membership={membership} isActive={isActive} tier={currentTier} />
      )}
    </div>
  );
}

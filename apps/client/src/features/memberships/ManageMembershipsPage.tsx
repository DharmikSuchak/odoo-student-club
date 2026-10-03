/**
 * ManageMembershipsPage — /manage/memberships
 *
 * Organizer (officer/treasurer/admin) view:
 *   - List all club memberships with status filter.
 *   - Create a new membership for a user.
 *   - Record a manual cash/offline payment (treasurer/admin only).
 *
 * All data comes from real API calls.
 * The manual payment form is clearly labelled as NOT an online payment.
 */
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { ApiError, Membership, MembershipTier } from '../../lib/api-client';
import {
  apiCreateMembership,
  apiGetTiers,
  apiListMemberships,
  apiRecordManualPayment,
} from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import { MembershipStatusBadge } from './MembershipStatusBadge';
import './membership.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateFormState {
  userId: string;
  tierId: string;
  startDate: string;
  endDate: string;
}

interface CreateFormErrors {
  userId?: string;
  tierId?: string;
  startDate?: string;
  endDate?: string;
  form?: string;
}

interface PaymentFormState {
  amountPaidCents: string;
}

interface PaymentFormErrors {
  amountPaidCents?: string;
  form?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatMoney(cents: number): string {
  return `₹${(cents / 100).toFixed(2)}`;
}

/** Computes a default endDate = 1 year from today, at midnight UTC. */
function defaultEndDate(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="ms-skeleton" aria-busy="true" aria-label="Loading memberships">
      {[1, 2, 3].map((i) => (
        <div key={i} className="ms-skeleton-line ms-skeleton-line--full" style={{ marginBottom: 14 }} />
      ))}
    </div>
  );
}

// ── Create Membership Modal ───────────────────────────────────────────────────

interface CreateModalProps {
  tiers: MembershipTier[];
  onClose: () => void;
  onCreated: (m: Membership) => void;
}

function CreateMembershipModal({ tiers, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<CreateFormState>({
    userId: '',
    tierId: tiers[0]?._id ?? '',
    startDate: todayIso(),
    endDate: defaultEndDate(),
  });
  const [errors, setErrors] = useState<CreateFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): CreateFormErrors {
    const e: CreateFormErrors = {};
    if (!/^[0-9a-f]{24}$/i.test(form.userId))
      e.userId = 'Must be a valid 24-character MongoDB ObjectId.';
    if (form.tierId.length === 0) e.tierId = 'Please select a tier.';
    if (form.startDate.length === 0) e.startDate = 'Start date is required.';
    if (form.endDate.length === 0) e.endDate = 'End date is required.';
    if (form.startDate.length > 0 && form.endDate.length > 0 && form.endDate <= form.startDate)
      e.endDate = 'End date must be after start date.';
    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setIsSubmitting(true);
    try {
      const res = await apiCreateMembership(
        form.userId,
        form.tierId,
        new Date(form.startDate).toISOString(),
        new Date(form.endDate).toISOString(),
      );
      onCreated(res.membership);
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({ form: apiErr.message ?? 'Failed to create membership.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      className="ms-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ms-modal">
        <div className="ms-modal-header">
          <h2 id="create-modal-title" className="ms-modal-title">Create Membership</h2>
          <button
            type="button"
            className="ms-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <form className="ms-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="ms-field">
            <label className="ms-label" htmlFor="create-userId">
              User ID <span aria-hidden="true">(MongoDB ObjectId)</span>
            </label>
            <input
              id="create-userId"
              className={`ms-input${errors.userId !== undefined ? ' ms-input--error' : ''}`}
              type="text"
              placeholder="507f1f77bcf86cd799439011"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              autoComplete="off"
              maxLength={24}
            />
            {errors.userId !== undefined && (
              <span className="ms-field-error" role="alert">{errors.userId}</span>
            )}
          </div>

          <div className="ms-field">
            <label className="ms-label" htmlFor="create-tierId">Membership tier</label>
            <select
              id="create-tierId"
              className={`ms-select${errors.tierId !== undefined ? ' ms-select--error' : ''}`}
              value={form.tierId}
              onChange={(e) => setForm((f) => ({ ...f, tierId: e.target.value }))}
            >
              {tiers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} — {formatMoney(t.priceCents)}
                </option>
              ))}
            </select>
            {errors.tierId !== undefined && (
              <span className="ms-field-error" role="alert">{errors.tierId}</span>
            )}
          </div>

          <div className="ms-form-row">
            <div className="ms-field">
              <label className="ms-label" htmlFor="create-startDate">Start date (UTC)</label>
              <input
                id="create-startDate"
                className={`ms-input${errors.startDate !== undefined ? ' ms-input--error' : ''}`}
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
              {errors.startDate !== undefined && (
                <span className="ms-field-error" role="alert">{errors.startDate}</span>
              )}
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="create-endDate">End date (UTC)</label>
              <input
                id="create-endDate"
                className={`ms-input${errors.endDate !== undefined ? ' ms-input--error' : ''}`}
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
              {errors.endDate !== undefined && (
                <span className="ms-field-error" role="alert">{errors.endDate}</span>
              )}
            </div>
          </div>

          {errors.form !== undefined && (
            <div className="ms-alert ms-alert--error" role="alert">{errors.form}</div>
          )}

          <div className="ms-modal-footer">
            <button type="button" className="ms-btn ms-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ms-btn ms-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create membership'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

interface PaymentModalProps {
  membership: Membership;
  onClose: () => void;
  onRecorded: (m: Membership) => void;
}

function RecordPaymentModal({ membership, onClose, onRecorded }: PaymentModalProps) {
  const [form, setForm] = useState<PaymentFormState>({ amountPaidCents: '' });
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): PaymentFormErrors {
    const e: PaymentFormErrors = {};
    const amount = Number(form.amountPaidCents);
    if (form.amountPaidCents.trim().length === 0 || isNaN(amount) || amount <= 0)
      e.amountPaidCents = 'Enter a positive amount in paise (e.g. 50000 = ₹500).';
    if (!Number.isInteger(amount))
      e.amountPaidCents = 'Amount must be a whole number of paise.';
    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setIsSubmitting(true);
    try {
      const res = await apiRecordManualPayment(membership._id, Number(form.amountPaidCents));
      onRecorded(res.membership);
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({ form: apiErr.message ?? 'Failed to record payment.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      className="ms-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ms-modal">
        <div className="ms-modal-header">
          <h2 id="pay-modal-title" className="ms-modal-title">Record Manual Payment</h2>
          <button
            type="button"
            className="ms-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Clearly label this as NOT an online payment */}
        <div className="ms-notice ms-notice--warning" role="note">
          <span>⚠️</span>
          <span>
            <strong>This is not an online payment.</strong> Use this form only to record that you
            have physically received cash or confirmed a bank transfer from the member.
          </span>
        </div>

        <form className="ms-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="ms-field">
            <label className="ms-label" htmlFor="pay-amount">
              Amount received (in paise — 50000 = ₹500)
            </label>
            <input
              id="pay-amount"
              className={`ms-input${errors.amountPaidCents !== undefined ? ' ms-input--error' : ''}`}
              type="number"
              inputMode="numeric"
              placeholder="50000"
              min="1"
              step="1"
              value={form.amountPaidCents}
              onChange={(e) => setForm((f) => ({ ...f, amountPaidCents: e.target.value }))}
            />
            {errors.amountPaidCents !== undefined && (
              <span className="ms-field-error" role="alert">{errors.amountPaidCents}</span>
            )}
          </div>

          {errors.form !== undefined && (
            <div className="ms-alert ms-alert--error" role="alert">{errors.form}</div>
          )}

          <div className="ms-modal-footer">
            <button type="button" className="ms-btn ms-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ms-btn ms-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Recording…' : 'Confirm receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * Organizer view — manage all club memberships.
 *
 * @returns The manage memberships page component.
 */
export function ManageMembershipsPage() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Membership | null>(null);

  const canRecordPayment =
    user !== null && (user.role === 'treasurer' || user.role === 'admin');

  const loadMemberships = useCallback(async (status?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiListMemberships(status !== '' ? status : undefined);
      setMemberships(res.memberships);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to load memberships.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const tiersRes = await apiGetTiers();
        if (!cancelled) setTiers(tiersRes.tiers);
      } catch {
        // non-fatal — tiers are optional for the table
      }
      await loadMemberships(statusFilter);
    }
    void init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(status: string) {
    setStatusFilter(status);
    void loadMemberships(status !== '' ? status : undefined);
  }

  function handleCreated(newMembership: Membership) {
    setMemberships((prev) => [newMembership, ...prev]);
  }

  function handlePaymentRecorded(updated: Membership) {
    setMemberships((prev) =>
      prev.map((m) => (m._id === updated._id ? updated : m)),
    );
  }

  const tierById = new Map(tiers.map((t) => [t._id, t]));

  return (
    <div className="memberships-page">
      <div className="memberships-heading-row">
        <div>
          <h1 className="memberships-title">Manage Memberships</h1>
          <p className="memberships-subtitle">
            Create memberships, verify active status, and record dues payments.
          </p>
        </div>
        <button
          type="button"
          className="ms-btn ms-btn--primary"
          onClick={() => setShowCreateModal(true)}
          id="btn-create-membership"
        >
          + New Membership
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="ms-toolbar">
        <label className="ms-label" htmlFor="status-filter" style={{ marginBottom: 0 }}>
          Filter by status:
        </label>
        <select
          id="status-filter"
          className="ms-filter-select"
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">All</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading && <TableSkeleton />}

      {!isLoading && error !== null && (
        <div className="ms-error" role="alert">⚠️ {error}</div>
      )}

      {!isLoading && error === null && memberships.length === 0 && (
        <div className="ms-empty">
          <span className="ms-empty-icon" aria-hidden="true">🗂️</span>
          <h2 className="ms-empty-title">No memberships found</h2>
          <p className="ms-empty-body">
            {statusFilter !== ''
              ? `No memberships with status "${statusFilter}". Try a different filter.`
              : 'No memberships have been created yet. Click "+ New Membership" to get started.'}
          </p>
        </div>
      )}

      {!isLoading && error === null && memberships.length > 0 && (
        <div className="ms-table-wrap">
          <table className="ms-table" aria-label="Memberships list">
            <thead>
              <tr>
                <th scope="col">Member ID</th>
                <th scope="col">Tier</th>
                <th scope="col">Status</th>
                <th scope="col">Start</th>
                <th scope="col">End</th>
                <th scope="col">Paid</th>
                {canRecordPayment && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => {
                const tier = tierById.get(m.tierId);
                return (
                  <tr key={m._id}>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        {m.userId.slice(-8)}…
                      </code>
                    </td>
                    <td>{tier?.name ?? '—'}</td>
                    <td>
                      <MembershipStatusBadge status={m.status} />
                    </td>
                    <td>{formatDate(m.startDate)}</td>
                    <td>{formatDate(m.endDate)}</td>
                    <td>
                      {m.amountPaidCents !== undefined
                        ? formatMoney(m.amountPaidCents)
                        : <span style={{ color: 'var(--slate-400)' }}>Unpaid</span>}
                    </td>
                    {canRecordPayment && (
                      <td>
                        {m.status === 'pending_payment' && (
                          <button
                            type="button"
                            className="ms-btn ms-btn--ghost"
                            style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                            onClick={() => setPaymentTarget(m)}
                            id={`btn-record-payment-${m._id}`}
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create membership modal */}
      {showCreateModal && (
        <CreateMembershipModal
          tiers={tiers}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Record payment modal */}
      {paymentTarget !== null && (
        <RecordPaymentModal
          membership={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
}

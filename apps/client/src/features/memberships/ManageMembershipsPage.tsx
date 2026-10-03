import { AlertCircle, FolderOpen, Info, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog } from '../../components/Dialog';
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

function defaultEndDate(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function TableSkeleton() {
  return (
    <div className="ms-skeleton" role="status" aria-label="Loading memberships">
      <span className="sr-only">Loading memberships…</span>
      {[1, 2, 3].map((i) => (
        <div key={i} className="ms-skeleton-line ms-skeleton-line--full" />
      ))}
    </div>
  );
}

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
    if (!/^[0-9a-f]{24}$/i.test(form.userId)) e.userId = 'Enter the member’s 24-character ID.';
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
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
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
    <Dialog titleId="create-modal-title" onClose={onClose} busy={isSubmitting}>
      <div className="ms-modal">
        <div className="ms-modal-header">
          <h2 id="create-modal-title" className="ms-modal-title">
            Create Membership
          </h2>
          <button
            type="button"
            className="ms-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <form className="ms-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="ms-field">
            <label className="ms-label" htmlFor="create-userId">
              Member ID
            </label>
            <input
              id="create-userId"
              aria-invalid={errors.userId !== undefined}
              aria-describedby={errors.userId !== undefined ? 'create-userId-error' : undefined}
              className={`ms-input${errors.userId !== undefined ? ' ms-input--error' : ''}`}
              type="text"
              placeholder="507f1f77bcf86cd799439011"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              autoComplete="off"
              maxLength={24}
            />
            {errors.userId !== undefined && (
              <span id="create-userId-error" className="ms-field-error" role="alert">
                {errors.userId}
              </span>
            )}
          </div>

          <div className="ms-field">
            <label className="ms-label" htmlFor="create-tierId">
              Membership tier
            </label>
            <select
              id="create-tierId"
              aria-invalid={errors.tierId !== undefined}
              aria-describedby={errors.tierId !== undefined ? 'create-tierId-error' : undefined}
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
              <span id="create-tierId-error" className="ms-field-error" role="alert">
                {errors.tierId}
              </span>
            )}
          </div>

          <div className="ms-form-row">
            <div className="ms-field">
              <label className="ms-label" htmlFor="create-startDate">
                Start date (UTC)
              </label>
              <input
                id="create-startDate"
                aria-invalid={errors.startDate !== undefined}
                aria-describedby={
                  errors.startDate !== undefined ? 'create-startDate-error' : undefined
                }
                className={`ms-input${errors.startDate !== undefined ? ' ms-input--error' : ''}`}
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
              {errors.startDate !== undefined && (
                <span id="create-startDate-error" className="ms-field-error" role="alert">
                  {errors.startDate}
                </span>
              )}
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="create-endDate">
                End date (UTC)
              </label>
              <input
                id="create-endDate"
                aria-invalid={errors.endDate !== undefined}
                aria-describedby={errors.endDate !== undefined ? 'create-endDate-error' : undefined}
                className={`ms-input${errors.endDate !== undefined ? ' ms-input--error' : ''}`}
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
              {errors.endDate !== undefined && (
                <span id="create-endDate-error" className="ms-field-error" role="alert">
                  {errors.endDate}
                </span>
              )}
            </div>
          </div>

          {errors.form !== undefined && (
            <div className="ms-alert ms-alert--error" role="alert">
              {errors.form}
            </div>
          )}

          <div className="ms-modal-footer">
            <button
              type="button"
              className="ms-btn ms-btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ms-btn ms-btn--primary"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create membership'}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

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
    if (!Number.isInteger(amount)) e.amountPaidCents = 'Amount must be a whole number of paise.';
    return e;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
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
    <Dialog titleId="pay-modal-title" onClose={onClose} busy={isSubmitting}>
      <div className="ms-modal">
        <div className="ms-modal-header">
          <h2 id="pay-modal-title" className="ms-modal-title">
            Record Manual Payment
          </h2>
          <button
            type="button"
            className="ms-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ms-notice ms-notice--warning" role="note">
          <Info size={18} aria-hidden="true" />
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
              aria-invalid={errors.amountPaidCents !== undefined}
              aria-describedby={
                errors.amountPaidCents !== undefined ? 'pay-amount-error' : undefined
              }
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
              <span id="pay-amount-error" className="ms-field-error" role="alert">
                {errors.amountPaidCents}
              </span>
            )}
          </div>

          {errors.form !== undefined && (
            <div className="ms-alert ms-alert--error" role="alert">
              {errors.form}
            </div>
          )}

          <div className="ms-modal-footer">
            <button
              type="button"
              className="ms-btn ms-btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ms-btn ms-btn--primary"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Recording…' : 'Confirm receipt'}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export function ManageMembershipsPage() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Membership | null>(null);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tiersError, setTiersError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const canRecordPayment = user !== null && (user.role === 'treasurer' || user.role === 'admin');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiListMemberships(statusFilter || undefined)
      .then((response) => {
        if (!cancelled) setMemberships(response.memberships);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(error instanceof Error ? error.message : 'Failed to load memberships.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setTiersLoading(true);
    setTiersError(null);
    apiGetTiers()
      .then((response) => {
        if (!cancelled) setTiers(response.tiers);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setTiersError(
            error instanceof Error ? error.message : 'Failed to load membership tiers.',
          );
      })
      .finally(() => {
        if (!cancelled) setTiersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function handleFilterChange(status: string) {
    setStatusFilter(status);
    setNotice(null);
  }

  function handleCreated() {
    setNotice('Membership created. It will remain pending until payment is recorded.');
    setReloadKey((previous) => previous + 1);
  }

  function handlePaymentRecorded() {
    setNotice('Payment recorded successfully.');
    setReloadKey((previous) => previous + 1);
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
          disabled={tiersLoading || tiersError !== null || tiers.length === 0}
          aria-describedby="membership-tier-status"
        >
          <Plus size={16} aria-hidden="true" /> New Membership
        </button>
      </div>

      <div id="membership-tier-status">
        {tiersLoading && (
          <p className="ms-notice ms-notice--info" role="status">
            Loading membership tiers…
          </p>
        )}
        {!tiersLoading && tiersError && (
          <div className="ms-notice ms-notice--warning" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>Membership tiers could not be loaded. {tiersError}</span>
            <button
              type="button"
              className="ms-btn ms-btn--ghost"
              onClick={() => setReloadKey((previous) => previous + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!tiersLoading && !tiersError && tiers.length === 0 && (
          <p className="ms-notice ms-notice--info" role="status">
            No membership tiers are available. Ask your club administrator to set up a tier before
            creating a membership.
          </p>
        )}
      </div>
      {notice && (
        <p className="ms-alert ms-alert--success" role="status">
          {notice}
        </p>
      )}
      <div className="ms-toolbar">
        <label className="ms-label" htmlFor="status-filter">
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

      {!isLoading && error === null && memberships.length === 0 && (
        <div className="ms-empty">
          <span className="ms-empty-icon" aria-hidden="true">
            <FolderOpen size={40} />
          </span>
          <h2 className="ms-empty-title">No memberships found</h2>
          <p className="ms-empty-body">
            {statusFilter !== ''
              ? `No ${statusFilter.replaceAll('_', ' ')} memberships. Try a different filter.`
              : 'No memberships have been created yet. Once a tier is available, use New Membership to get started.'}
          </p>
          {statusFilter !== '' && (
            <button
              type="button"
              className="ms-btn ms-btn--ghost"
              onClick={() => handleFilterChange('')}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {!isLoading && error === null && memberships.length > 0 && (
        // Keyboard users need to focus this region to scroll a wide table on narrow screens.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <div className="ms-table-wrap" role="region" aria-label="Membership records" tabIndex={0}>
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
                      <code className="ms-member-id" title={m.userId}>
                        {m.userId.slice(-8)}…
                      </code>
                    </td>
                    <td>{tier?.name ?? (tiersLoading ? 'Loading…' : 'Unavailable')}</td>
                    <td>
                      <MembershipStatusBadge status={m.status} />
                    </td>
                    <td>{formatDate(m.startDate)}</td>
                    <td>{formatDate(m.endDate)}</td>
                    <td>
                      {m.amountPaidCents !== undefined ? (
                        formatMoney(m.amountPaidCents)
                      ) : (
                        <span className="ms-muted">Unpaid</span>
                      )}
                    </td>
                    {canRecordPayment && (
                      <td>
                        {m.status === 'pending_payment' && (
                          <button
                            type="button"
                            className="ms-btn ms-btn--ghost"

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

      {showCreateModal && (
        <CreateMembershipModal
          tiers={tiers}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

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

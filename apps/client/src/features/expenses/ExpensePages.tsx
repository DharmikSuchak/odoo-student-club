import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  FileText,
  Receipt,
  WalletCards,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  type ApiError,
  type Expense,
  type ExpenseStatus,
  type MoneyBreakdown,
  type TreasurerCurrencySummary,
  apiCreateExpense,
  apiGetTreasurerReport,
  apiListExpenses,
  apiListMyExpenses,
  apiReimburseExpense,
  apiReviewExpense,
} from '../../lib/api-client';

import './expense.css';

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
    amountCents / 100,
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parseMinorUnits(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (match === null) return null;
  const major = match[1];
  if (major === undefined) return null;
  const minor = (match[2] ?? '').padEnd(2, '0');
  const result = Number(major) * 100 + Number(minor);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function getErrorMessage(error: unknown): string {
  return (error as ApiError).message ?? 'Something went wrong. Please try again.';
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <span className={`expense-badge expense-badge--${status}`}>{status}</span>;
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="expense-error" role="alert">
      <AlertCircle size={24} aria-hidden="true" />
      <p>{message}</p>
      <button type="button" className="expense-button expense-button--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  return (
    <div className="expense-table-wrap">
      <table className="expense-table">
        <thead>
          <tr>
            <th>Submitted</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Receipt reference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense._id}>
              <td>{formatDate(expense.createdAt)}</td>
              <td>{expense.category}</td>
              <td>{formatMoney(expense.amountCents, expense.currency)}</td>
              <td className="expense-reference">{expense.receiptReference}</td>
              <td>
                <ExpenseStatusBadge status={expense.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Organizer expense submission screen with a history of their own records. */
export function ExpenseSubmissionPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [category, setCategory] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiListMyExpenses();
      setExpenses(response.expenses);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseMinorUnits(amount);
    if (amountCents === null) {
      setError('Enter a positive amount with no more than two decimal places.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiCreateExpense({
        amountCents,
        category,
        currency,
        receiptReference,
      });
      setExpenses((current) => [response.expense, ...current]);
      setAmount('');
      setCategory('');
      setReceiptReference('');
      setSuccess('Expense submitted for treasurer review.');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="expense-page">
      <header className="expense-heading">
        <div>
          <h1>Submit an expense</h1>
          <p>Record a club cost and its receipt reference for treasurer review.</p>
        </div>
      </header>

      <form className="expense-form-card" onSubmit={(event) => void handleSubmit(event)}>
        <div className="expense-form-grid">
          <label className="expense-field">
            <span>Amount</span>
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="expense-field">
            <span>Currency</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="expense-field">
            <span>Category</span>
            <input
              required
              maxLength={100}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Travel, supplies, venue…"
            />
          </label>
          <label className="expense-field">
            <span>Receipt reference</span>
            <input
              required
              maxLength={500}
              value={receiptReference}
              onChange={(event) => setReceiptReference(event.target.value)}
              placeholder="Receipt number, drive link, or invoice ID"
            />
          </label>
        </div>
        <p className="expense-help">
          Amounts are stored as integer minor units for accurate totals.
        </p>
        {error !== null && <p className="expense-alert expense-alert--error">{error}</p>}
        {success !== null && <p className="expense-alert expense-alert--success">{success}</p>}
        <button className="expense-button expense-button--primary" disabled={isSubmitting}>
          <Receipt size={17} aria-hidden="true" />
          {isSubmitting ? 'Submitting…' : 'Submit expense'}
        </button>
      </form>

      <section className="expense-section" aria-labelledby="my-expenses-heading">
        <h2 id="my-expenses-heading">My submissions</h2>
        {isLoading && <p className="expense-loading">Loading expenses…</p>}
        {!isLoading && error !== null && expenses.length === 0 && (
          <PageError message={error} onRetry={() => void loadExpenses()} />
        )}
        {!isLoading && error === null && expenses.length === 0 && (
          <div className="expense-empty">
            <FileText size={38} aria-hidden="true" />
            <h3>No expenses submitted</h3>
            <p>Your submitted expenses and review status will appear here.</p>
          </div>
        )}
        {expenses.length > 0 && <ExpenseTable expenses={expenses} />}
      </section>
    </div>
  );
}

/** Treasurer-only queue for reviewing and reimbursing expenses. */
export function ExpenseReviewPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<ExpenseStatus | 'all'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiListExpenses(filter === 'all' ? undefined : filter);
      setExpenses(response.expenses);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  async function updateExpense(expense: Expense, action: 'approved' | 'rejected' | 'reimbursed') {
    setWorkingId(expense._id);
    setError(null);
    try {
      const response =
        action === 'reimbursed'
          ? await apiReimburseExpense(expense._id)
          : await apiReviewExpense(expense._id, action);
      setExpenses((current) =>
        filter !== 'all'
          ? current.filter((item) => item._id !== expense._id)
          : current.map((item) => (item._id === expense._id ? response.expense : item)),
      );
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="expense-page">
      <header className="expense-heading">
        <div>
          <h1>Expense review</h1>
          <p>Approve, reject, and record reimbursement of organizer expenses.</p>
        </div>
        <label className="expense-filter">
          <span className="sr-only">Filter by status</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ExpenseStatus | 'all')}
          >
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="reimbursed">Reimbursed</option>
            <option value="all">All states</option>
          </select>
        </label>
      </header>
      {error !== null && <p className="expense-alert expense-alert--error">{error}</p>}
      {isLoading && <p className="expense-loading">Loading review queue…</p>}
      {!isLoading && expenses.length === 0 && (
        <div className="expense-empty">
          <Check size={38} aria-hidden="true" />
          <h2>Nothing in this queue</h2>
          <p>Expenses will appear here when they match the selected state.</p>
        </div>
      )}
      {!isLoading && expenses.length > 0 && (
        <div className="expense-review-list">
          {expenses.map((expense) => (
            <article className="expense-review-card" key={expense._id}>
              <div className="expense-review-main">
                <div className="expense-review-title">
                  <h2>{expense.category}</h2>
                  <ExpenseStatusBadge status={expense.status} />
                </div>
                <strong>{formatMoney(expense.amountCents, expense.currency)}</strong>
                <p>{expense.receiptReference}</p>
                <small>
                  Submitted {formatDate(expense.createdAt)} by {expense.submittedBy}
                </small>
                {expense.reviewedBy !== undefined && (
                  <small>
                    Decision by {expense.reviewedBy}
                    {expense.reviewedAt !== undefined
                      ? ` on ${formatDate(expense.reviewedAt)}`
                      : ''}
                  </small>
                )}
              </div>
              <div className="expense-actions">
                {expense.status === 'pending' && (
                  <>
                    <button
                      className="expense-button expense-button--approve"
                      disabled={workingId === expense._id}
                      onClick={() => void updateExpense(expense, 'approved')}
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button
                      className="expense-button expense-button--reject"
                      disabled={workingId === expense._id}
                      onClick={() => void updateExpense(expense, 'rejected')}
                    >
                      <X size={16} /> Reject
                    </button>
                  </>
                )}
                {expense.status === 'approved' && (
                  <button
                    className="expense-button expense-button--primary"
                    disabled={workingId === expense._id}
                    onClick={() => void updateExpense(expense, 'reimbursed')}
                  >
                    <WalletCards size={16} /> Mark reimbursed
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportRow({
  label,
  values,
  currency,
}: {
  label: string;
  values: MoneyBreakdown;
  currency: string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{formatMoney(values.settled, currency)}</td>
      <td>{formatMoney(values.pending, currency)}</td>
      <td>{formatMoney(values.total, currency)}</td>
    </tr>
  );
}

function CurrencyReport({ summary }: { summary: TreasurerCurrencySummary }) {
  return (
    <section className="report-currency" aria-labelledby={`report-${summary.currency}`}>
      <div className="report-currency-heading">
        <h2 id={`report-${summary.currency}`}>{summary.currency}</h2>
        <span>Computed from current payment and expense records</span>
      </div>
      <div className="report-stat-grid">
        <article className="report-stat report-stat--income">
          <ArrowUpCircle aria-hidden="true" />
          <span>Total income</span>
          <strong>{formatMoney(summary.income.total, summary.currency)}</strong>
          <small>{formatMoney(summary.income.settled, summary.currency)} settled</small>
        </article>
        <article className="report-stat report-stat--outgoing">
          <ArrowDownCircle aria-hidden="true" />
          <span>Approved outgoing</span>
          <strong>{formatMoney(summary.outgoing.total, summary.currency)}</strong>
          <small>{formatMoney(summary.outgoing.pending, summary.currency)} pending payout</small>
        </article>
        <article className="report-stat report-stat--balance">
          <WalletCards aria-hidden="true" />
          <span>Projected left</span>
          <strong>{formatMoney(summary.balance.projected, summary.currency)}</strong>
          <small>{formatMoney(summary.balance.settled, summary.currency)} settled balance</small>
        </article>
      </div>
      <div className="expense-table-wrap">
        <table className="expense-table report-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Settled</th>
              <th>Pending</th>
              <th>Total / projected</th>
            </tr>
          </thead>
          <tbody>
            <ReportRow label="Membership dues" values={summary.dues} currency={summary.currency} />
            <ReportRow
              label="Ticket revenue"
              values={summary.ticketRevenue}
              currency={summary.currency}
            />
            <ReportRow label="Total income" values={summary.income} currency={summary.currency} />
            <ReportRow
              label="Approved expenses"
              values={summary.outgoing}
              currency={summary.currency}
            />
            <tr className="report-balance-row">
              <th scope="row">What’s left</th>
              <td>{formatMoney(summary.balance.settled, summary.currency)}</td>
              <td>—</td>
              <td>{formatMoney(summary.balance.projected, summary.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="report-footnote">
        {summary.expenseCounts.pendingReview} awaiting review ·{' '}
        {summary.expenseCounts.awaitingReimbursement} approved awaiting reimbursement ·{' '}
        {summary.expenseCounts.reimbursed} reimbursed
      </p>
    </section>
  );
}

/** Treasurer-only financial report computed from payments and approved expenses. */
export function TreasurerReportPage() {
  const [summaries, setSummaries] = useState<TreasurerCurrencySummary[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGetTreasurerReport();
      setSummaries(response.summaries);
      setGeneratedAt(response.generatedAt);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <div className="expense-page">
      <header className="expense-heading">
        <div>
          <h1>Treasurer report</h1>
          <p>Dues, ticket revenue, approved expenses, and remaining funds by currency.</p>
        </div>
        {generatedAt !== null && <small>Updated {new Date(generatedAt).toLocaleString()}</small>}
      </header>
      <div className="expense-report-note" role="note">
        <AlertCircle size={18} aria-hidden="true" />
        Settled values reflect completed payments or reimbursements. Projected values also include
        pending payments and approved expenses awaiting payout.
      </div>
      {isLoading && <p className="expense-loading">Computing report…</p>}
      {!isLoading && error !== null && (
        <PageError message={error} onRetry={() => void loadReport()} />
      )}
      {!isLoading && error === null && summaries.length === 0 && (
        <div className="expense-empty">
          <WalletCards size={38} aria-hidden="true" />
          <h2>No financial records yet</h2>
          <p>Dues, ticket payments, and approved expenses will be summarized here.</p>
        </div>
      )}
      {summaries.map((summary) => (
        <CurrencyReport key={summary.currency} summary={summary} />
      ))}
    </div>
  );
}

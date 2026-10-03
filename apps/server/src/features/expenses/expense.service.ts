import { ObjectId, type Collection } from 'mongodb';

import {
  expenseDocumentSchema,
  type ExpenseDocument,
  type ExpenseStatus,
} from '../../db/schemas/expense.schema.js';
import type { PaymentStatus } from '../../db/schemas/payment.schema.js';
import { AppError } from '../../middleware/error-handler.js';

export type SafeExpense = ExpenseDocument & { _id: ObjectId };

export interface MoneyBreakdown {
  settled: number;
  pending: number;
  total: number;
}

export interface TreasurerCurrencySummary {
  currency: string;
  dues: MoneyBreakdown;
  ticketRevenue: MoneyBreakdown;
  merchandiseRevenue: MoneyBreakdown;
  income: MoneyBreakdown;
  outgoing: MoneyBreakdown;
  balance: { settled: number; projected: number };
  expenseCounts: {
    pendingReview: number;
    awaitingReimbursement: number;
    reimbursed: number;
  };
}

interface CreateExpenseInput {
  clubId: string;
  submittedBy: string;
  category: string;
  amountCents: number;
  currency: string;
  receiptReference: string;
}

interface ReportPayment {
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  relatedEntity: { type: string };
}

function parseObjectId(id: string, name: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${name}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(id);
}

function emptyMoneyBreakdown(): MoneyBreakdown {
  return { settled: 0, pending: 0, total: 0 };
}

function emptyCurrencySummary(currency: string): TreasurerCurrencySummary {
  return {
    currency,
    dues: emptyMoneyBreakdown(),
    ticketRevenue: emptyMoneyBreakdown(),
    merchandiseRevenue: emptyMoneyBreakdown(),
    income: emptyMoneyBreakdown(),
    outgoing: emptyMoneyBreakdown(),
    balance: { settled: 0, projected: 0 },
    expenseCounts: { pendingReview: 0, awaitingReimbursement: 0, reimbursed: 0 },
  };
}

function getCurrencySummary(
  summaries: Map<string, TreasurerCurrencySummary>,
  currency: string,
): TreasurerCurrencySummary {
  const existing = summaries.get(currency);
  if (existing !== undefined) return existing;
  const created = emptyCurrencySummary(currency);
  summaries.set(currency, created);
  return created;
}

function addPayment(
  summaries: Map<string, TreasurerCurrencySummary>,
  payment: ReportPayment,
): void {
  if (payment.status !== 'succeeded' && payment.status !== 'pending') return;
  if (
    payment.relatedEntity.type !== 'membership' &&
    payment.relatedEntity.type !== 'event_ticket' &&
    payment.relatedEntity.type !== 'order'
  ) {
    return;
  }
  const summary = getCurrencySummary(summaries, payment.currency);
  const target =
    payment.relatedEntity.type === 'membership'
      ? summary.dues
      : payment.relatedEntity.type === 'event_ticket'
        ? summary.ticketRevenue
        : summary.merchandiseRevenue;
  target[payment.status === 'succeeded' ? 'settled' : 'pending'] += payment.amountCents;
}

function addExpense(summary: TreasurerCurrencySummary, expense: ExpenseDocument): void {
  if (expense.status === 'pending') summary.expenseCounts.pendingReview += 1;
  if (expense.status === 'approved') {
    summary.outgoing.pending += expense.amountCents;
    summary.expenseCounts.awaitingReimbursement += 1;
  }
  if (expense.status === 'reimbursed') {
    summary.outgoing.settled += expense.amountCents;
    summary.expenseCounts.reimbursed += 1;
  }
}

function finalizeSummary(summary: TreasurerCurrencySummary): void {
  summary.dues.total = summary.dues.settled + summary.dues.pending;
  summary.ticketRevenue.total = summary.ticketRevenue.settled + summary.ticketRevenue.pending;
  summary.merchandiseRevenue.total =
    summary.merchandiseRevenue.settled + summary.merchandiseRevenue.pending;
  summary.income.settled =
    summary.dues.settled + summary.ticketRevenue.settled + summary.merchandiseRevenue.settled;
  summary.income.pending =
    summary.dues.pending + summary.ticketRevenue.pending + summary.merchandiseRevenue.pending;
  summary.income.total = summary.income.settled + summary.income.pending;
  summary.outgoing.total = summary.outgoing.settled + summary.outgoing.pending;
  summary.balance.settled = summary.income.settled - summary.outgoing.settled;
  summary.balance.projected = summary.income.total - summary.outgoing.total;
}

export async function createExpense(
  expenses: Collection,
  input: CreateExpenseInput,
): Promise<SafeExpense> {
  const now = new Date();
  const document = expenseDocumentSchema.parse({
    clubId: parseObjectId(input.clubId, 'clubId').toHexString(),
    submittedBy: parseObjectId(input.submittedBy, 'submittedBy').toHexString(),
    category: input.category,
    amountCents: input.amountCents,
    currency: input.currency,
    receiptReference: input.receiptReference,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  const result = await expenses.insertOne(document);
  const created = await expenses.findOne<SafeExpense>({ _id: result.insertedId });
  if (created === null) throw new AppError('Failed to retrieve the submitted expense.', 500, false);
  return created;
}

export async function listOwnExpenses(
  expenses: Collection,
  clubId: string,
  userId: string,
): Promise<SafeExpense[]> {
  return expenses
    .find<SafeExpense>(
      {
        clubId: parseObjectId(clubId, 'clubId').toHexString(),
        submittedBy: parseObjectId(userId, 'userId').toHexString(),
      },
      { sort: { createdAt: -1 } },
    )
    .toArray();
}

export async function listExpenses(
  expenses: Collection,
  clubId: string,
  status?: ExpenseStatus,
): Promise<SafeExpense[]> {
  const filter: Record<string, unknown> = {
    clubId: parseObjectId(clubId, 'clubId').toHexString(),
  };
  if (status !== undefined) filter['status'] = status;
  return expenses.find<SafeExpense>(filter, { sort: { createdAt: -1 } }).toArray();
}

export async function reviewExpense(
  expenses: Collection,
  clubId: string,
  expenseId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
): Promise<SafeExpense> {
  const objectId = parseObjectId(expenseId, 'expenseId');
  const club = parseObjectId(clubId, 'clubId').toHexString();
  const existing = await expenses.findOne<SafeExpense>({ _id: objectId, clubId: club });
  if (existing === null) throw new AppError('Expense not found.', 404);
  if (existing.status !== 'pending')
    throw new AppError('Only pending expenses can be reviewed.', 409);
  const now = new Date();
  const updateResult = await expenses.updateOne(
    { _id: objectId, clubId: club, status: 'pending' },
    {
      $set: {
        status: decision,
        reviewedBy: parseObjectId(reviewerId, 'reviewerId').toHexString(),
        reviewedAt: now,
        updatedAt: now,
      },
    },
  );
  if (updateResult.matchedCount === 0) {
    throw new AppError('Expense state changed before the review was saved.', 409);
  }
  return getUpdatedExpense(expenses, objectId);
}

export async function reimburseExpense(
  expenses: Collection,
  clubId: string,
  expenseId: string,
  treasurerId: string,
): Promise<SafeExpense> {
  const objectId = parseObjectId(expenseId, 'expenseId');
  const club = parseObjectId(clubId, 'clubId').toHexString();
  const existing = await expenses.findOne<SafeExpense>({ _id: objectId, clubId: club });
  if (existing === null) throw new AppError('Expense not found.', 404);
  if (existing.status !== 'approved') {
    throw new AppError('Only approved expenses can be marked reimbursed.', 409);
  }
  const now = new Date();
  const updateResult = await expenses.updateOne(
    { _id: objectId, clubId: club, status: 'approved' },
    {
      $set: {
        status: 'reimbursed',
        reimbursedBy: parseObjectId(treasurerId, 'treasurerId').toHexString(),
        reimbursedAt: now,
        updatedAt: now,
      },
    },
  );
  if (updateResult.matchedCount === 0) {
    throw new AppError('Expense state changed before reimbursement was saved.', 409);
  }
  return getUpdatedExpense(expenses, objectId);
}

async function getUpdatedExpense(expenses: Collection, objectId: ObjectId): Promise<SafeExpense> {
  const updated = await expenses.findOne<SafeExpense>({ _id: objectId });
  if (updated === null) throw new AppError('Failed to retrieve the updated expense.', 500, false);
  return updated;
}

export async function buildTreasurerReport(
  payments: Collection,
  expenses: Collection,
  clubId: string,
): Promise<TreasurerCurrencySummary[]> {
  const club = parseObjectId(clubId, 'clubId').toHexString();
  const [paymentRecords, expenseRecords] = await Promise.all([
    payments.find<ReportPayment>({}).toArray(),
    expenses.find<ExpenseDocument>({ clubId: club }).toArray(),
  ]);
  const summaries = new Map<string, TreasurerCurrencySummary>();
  for (const payment of paymentRecords) {
    addPayment(summaries, payment);
  }
  for (const expense of expenseRecords) {
    addExpense(getCurrencySummary(summaries, expense.currency), expense);
  }
  const result = [...summaries.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
  result.forEach(finalizeSummary);
  return result;
}

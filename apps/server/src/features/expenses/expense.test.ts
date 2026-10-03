import type { Express } from 'express';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakeDb, resetDb } = vi.hoisted(() => {
  type FakeDocument = Record<string, unknown> & { _id: { toString(): string } };
  const stores = new Map<string, FakeDocument[]>();

  function valuesMatch(actual: unknown, expected: unknown): boolean {
    if (expected !== null && typeof expected === 'object' && 'toString' in expected) {
      const expectedValue = (expected as { toString(): string }).toString();
      if (typeof actual === 'string') return actual === expectedValue;
      if (actual !== null && typeof actual === 'object' && 'toString' in actual) {
        return (actual as { toString(): string }).toString() === expectedValue;
      }
      return false;
    }
    return actual === expected;
  }

  function matches(document: FakeDocument, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([key, value]) => valuesMatch(document[key], value));
  }

  function collection(name: string) {
    const getStore = () => {
      const existing = stores.get(name);
      if (existing !== undefined) return existing;
      const created: FakeDocument[] = [];
      stores.set(name, created);
      return created;
    };
    return {
      insertOne: (input: Record<string, unknown>) => {
        const insertedId = new ObjectId();
        getStore().push({ ...input, _id: insertedId });
        return Promise.resolve({ insertedId });
      },
      findOne: (filter: Record<string, unknown>) =>
        Promise.resolve(getStore().find((document) => matches(document, filter)) ?? null),
      updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const document = getStore().find((candidate) => matches(candidate, filter));
        if (document === undefined) return Promise.resolve({ matchedCount: 0 });
        const setValues = (update as { $set: Record<string, unknown> }).$set;
        Object.assign(document, setValues);
        return Promise.resolve({ matchedCount: 1 });
      },
      find: (filter: Record<string, unknown>) => ({
        toArray: () => Promise.resolve(getStore().filter((document) => matches(document, filter))),
      }),
    };
  }

  return {
    fakeDb: { collection },
    resetDb: () => stores.clear(),
  };
});

vi.mock('../../db/connection.js', () => ({ getDb: () => fakeDb }));

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt, type AuthUser } from '../../middleware/auth.js';

import type { TreasurerCurrencySummary } from './expense.service.js';

let app: Express;
const MEMBER_ID = '000000000000000000000010';
const OFFICER_ID = '000000000000000000000020';
const TREASURER_ID = '000000000000000000000030';

function authCookie(role: AuthUser['role'], userId: string): string {
  const token = signJwt({ userId, role, email: `${role}@example.com`, displayName: role });
  return `access_token=${token}`;
}

interface ExpenseResponseBody {
  expense: {
    _id: string;
    status: string;
    reviewedBy?: string;
    reimbursedBy?: string;
  };
}

interface ReportResponseBody {
  summaries: TreasurerCurrencySummary[];
}

function expenseInput(category: string) {
  return {
    category,
    amountCents: 2500,
    currency: 'INR',
    receiptReference: `receipt-${category}`,
  };
}

beforeAll(() => {
  app = createApp(env);
});

beforeEach(() => {
  resetDb();
});

describe('expense authorization', () => {
  it('denies a member access to the treasurer report', async () => {
    const response = await request(app)
      .get('/api/expenses/report')
      .set('Cookie', authCookie('member', MEMBER_ID));
    expect(response.status).toBe(403);
  });

  it('denies a member access to expense approval', async () => {
    const response = await request(app)
      .patch('/api/expenses/000000000000000000000099/review')
      .set('Cookie', authCookie('member', MEMBER_ID))
      .send({ decision: 'approved' });
    expect(response.status).toBe(403);
  });
});

describe('expense lifecycle', () => {
  it('records pending, approved, rejected, and reimbursed states with decision makers', async () => {
    const officerCookie = authCookie('officer', OFFICER_ID);
    const treasurerCookie = authCookie('treasurer', TREASURER_ID);

    const pendingResponse = await request(app)
      .post('/api/expenses')
      .set('Cookie', officerCookie)
      .send(expenseInput('Travel'));
    expect(pendingResponse.status).toBe(201);
    expect((pendingResponse.body as ExpenseResponseBody).expense.status).toBe('pending');

    const approvedSource = await request(app)
      .post('/api/expenses')
      .set('Cookie', officerCookie)
      .send(expenseInput('Supplies'));
    const approvedId = (approvedSource.body as ExpenseResponseBody).expense._id;
    const approvedResponse = await request(app)
      .patch(`/api/expenses/${approvedId}/review`)
      .set('Cookie', treasurerCookie)
      .send({ decision: 'approved' });
    expect((approvedResponse.body as ExpenseResponseBody).expense).toMatchObject({
      status: 'approved',
      reviewedBy: TREASURER_ID,
    });

    const rejectedSource = await request(app)
      .post('/api/expenses')
      .set('Cookie', officerCookie)
      .send(expenseInput('Venue'));
    const rejectedId = (rejectedSource.body as ExpenseResponseBody).expense._id;
    const rejectedResponse = await request(app)
      .patch(`/api/expenses/${rejectedId}/review`)
      .set('Cookie', treasurerCookie)
      .send({ decision: 'rejected' });
    expect((rejectedResponse.body as ExpenseResponseBody).expense).toMatchObject({
      status: 'rejected',
      reviewedBy: TREASURER_ID,
    });

    const reimbursedResponse = await request(app)
      .patch(`/api/expenses/${approvedId}/reimburse`)
      .set('Cookie', treasurerCookie);
    expect((reimbursedResponse.body as ExpenseResponseBody).expense).toMatchObject({
      status: 'reimbursed',
      reviewedBy: TREASURER_ID,
      reimbursedBy: TREASURER_ID,
    });
  });
});

describe('treasurer report', () => {
  it('matches income, outgoing, and balance to the sum of source records', async () => {
    const payments = fakeDb.collection('payments');
    const expenses = fakeDb.collection('expenses');
    const now = new Date();

    await payments.insertOne({
      amountCents: 10000,
      currency: 'INR',
      status: 'succeeded',
      relatedEntity: { type: 'membership' },
    });
    await payments.insertOne({
      amountCents: 2000,
      currency: 'INR',
      status: 'pending',
      relatedEntity: { type: 'membership' },
    });
    await payments.insertOne({
      amountCents: 5000,
      currency: 'INR',
      status: 'succeeded',
      relatedEntity: { type: 'event_ticket' },
    });
    await payments.insertOne({
      amountCents: 9999,
      currency: 'INR',
      status: 'succeeded',
      relatedEntity: { type: 'order' },
    });

    const baseExpense = {
      clubId: env.CLUB_ID,
      submittedBy: OFFICER_ID,
      category: 'Operations',
      currency: 'INR',
      receiptReference: 'receipt',
      createdAt: now,
      updatedAt: now,
    };
    await expenses.insertOne({ ...baseExpense, amountCents: 4000, status: 'approved' });
    await expenses.insertOne({ ...baseExpense, amountCents: 1000, status: 'reimbursed' });
    await expenses.insertOne({ ...baseExpense, amountCents: 7000, status: 'rejected' });
    await expenses.insertOne({ ...baseExpense, amountCents: 3000, status: 'pending' });

    const response = await request(app)
      .get('/api/expenses/report')
      .set('Cookie', authCookie('treasurer', TREASURER_ID));
    expect(response.status).toBe(200);
    const summary = (response.body as ReportResponseBody).summaries[0];
    if (summary === undefined) throw new Error('Expected an INR report summary.');
    expect(summary.dues).toEqual({ settled: 10000, pending: 2000, total: 12000 });
    expect(summary.ticketRevenue).toEqual({ settled: 5000, pending: 0, total: 5000 });
    expect(summary.income.total).toBe(summary.dues.total + summary.ticketRevenue.total);
    expect(summary.outgoing).toEqual({ settled: 1000, pending: 4000, total: 5000 });
    expect(summary.balance.settled).toBe(summary.income.settled - summary.outgoing.settled);
    expect(summary.balance.projected).toBe(summary.income.total - summary.outgoing.total);
    expect(summary.expenseCounts).toEqual({
      pendingReview: 1,
      awaitingReimbursement: 1,
      reimbursed: 1,
    });
  });
});

import type { Express } from 'express';
import type { Collection } from 'mongodb';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

import { getDashboardSummary } from './dashboard.service.js';

interface FakeRecord {
  clubId: string;
  status?: string;
  endDate?: Date;
  startsAt?: Date;
  isPublished?: boolean;
}

function matches(record: FakeRecord, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([field, expected]) => {
    const actual = record[field as keyof FakeRecord];
    if (expected !== null && typeof expected === 'object' && '$gt' in expected) {
      return actual instanceof Date && actual > (expected as { $gt: Date }).$gt;
    }
    if (expected !== null && typeof expected === 'object' && '$in' in expected) {
      return (expected as { $in: unknown[] }).$in.includes(actual);
    }
    return actual === expected;
  });
}

function fakeCollection(records: FakeRecord[]): Collection {
  return {
    countDocuments: (filter: Record<string, unknown>) =>
      Promise.resolve(records.filter((record) => matches(record, filter)).length),
  } as unknown as Collection;
}

describe('dashboard summary', () => {
  it('counts active memberships, upcoming published events, open tasks, and pending dues', async () => {
    const asOf = new Date('2030-01-01T00:00:00.000Z');
    const memberships = fakeCollection([
      { clubId: env.CLUB_ID, status: 'active', endDate: new Date('2031-01-01T00:00:00Z') },
      { clubId: env.CLUB_ID, status: 'active', endDate: new Date('2029-01-01T00:00:00Z') },
      { clubId: env.CLUB_ID, status: 'pending_payment' },
    ]);
    const events = fakeCollection([
      {
        clubId: env.CLUB_ID,
        isPublished: true,
        startsAt: new Date('2030-02-01T00:00:00Z'),
      },
      {
        clubId: env.CLUB_ID,
        isPublished: false,
        startsAt: new Date('2030-03-01T00:00:00Z'),
      },
    ]);
    const tasks = fakeCollection([
      { clubId: env.CLUB_ID, status: 'not_started' },
      { clubId: env.CLUB_ID, status: 'in_progress' },
      { clubId: env.CLUB_ID, status: 'done' },
    ]);

    await expect(
      getDashboardSummary(memberships, events, tasks, env.CLUB_ID, asOf),
    ).resolves.toEqual({ activeMembers: 1, upcomingEvents: 1, openTasks: 2, pendingDues: 1 });
  });

  it('requires authentication at the HTTP boundary', async () => {
    const app: Express = createApp(env);
    const response = await request(app).get('/api/dashboard/summary');
    expect(response.status).toBe(401);
  });
});

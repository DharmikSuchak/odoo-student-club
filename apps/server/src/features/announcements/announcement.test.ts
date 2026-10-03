import type { Express } from 'express';
import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakeDb, resetDb } = vi.hoisted(() => {
  type FakeDocument = Record<string, unknown> & { _id: ObjectId };
  const stores = new Map<string, FakeDocument[]>();

  function comparable(value: unknown): unknown {
    if (value instanceof Date) return value.getTime();
    if (value !== null && typeof value === 'object' && 'toString' in value) {
      return (value as { toString(): string }).toString();
    }
    return value;
  }

  function matches(document: FakeDocument, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(
      ([key, value]) => comparable(document[key]) === comparable(value),
    );
  }

  function collection(name: string) {
    const getStore = (): FakeDocument[] => {
      const existing = stores.get(name);
      if (existing !== undefined) return existing;
      const created: FakeDocument[] = [];
      stores.set(name, created);
      return created;
    };
    return {
      insertOne: (input: Record<string, unknown>) => {
        const insertedId = input['_id'] instanceof ObjectId ? input['_id'] : new ObjectId();
        getStore().push({ ...input, _id: insertedId });
        return Promise.resolve({ insertedId });
      },
      findOne: (filter: Record<string, unknown>) =>
        Promise.resolve(getStore().find((document) => matches(document, filter)) ?? null),
      updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const document = getStore().find((candidate) => matches(candidate, filter));
        if (document === undefined) return Promise.resolve({ matchedCount: 0 });
        Object.assign(document, (update as { $set: Record<string, unknown> }).$set);
        return Promise.resolve({ matchedCount: 1 });
      },
      find: (filter: Record<string, unknown>, options?: { sort?: Record<string, 1 | -1> }) => ({
        toArray: () => {
          const result = getStore().filter((document) => matches(document, filter));
          const sort = options?.sort;
          if (sort !== undefined) {
            result.sort((left, right) => {
              for (const [field, direction] of Object.entries(sort)) {
                const leftValue = comparable(left[field]);
                const rightValue = comparable(right[field]);
                if (leftValue === rightValue) continue;
                return (leftValue as number | boolean) > (rightValue as number | boolean)
                  ? direction
                  : -direction;
              }
              return 0;
            });
          }
          return Promise.resolve(result);
        },
      }),
    };
  }

  return { fakeDb: { collection }, resetDb: () => stores.clear() };
});

vi.mock('../../db/connection.js', () => ({ getDb: () => fakeDb }));

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt, type AuthUser } from '../../middleware/auth.js';

let app: Express;
const MEMBER_ID = '000000000000000000000010';
const FIRST_OFFICER_ID = '000000000000000000000020';
const SECOND_OFFICER_ID = '000000000000000000000021';

function authCookie(role: AuthUser['role'], userId: string): string {
  const token = signJwt({ userId, role, email: `${userId}@example.com`, displayName: role });
  return `access_token=${token}`;
}

interface AnnouncementResponseBody {
  announcement: { _id: string; title: string; authorId: string };
}

interface AnnouncementListResponseBody {
  announcements: Array<{ title: string }>;
}

beforeAll(() => {
  app = createApp(env);
});

beforeEach(() => {
  resetDb();
});

describe('announcement authorization', () => {
  it('denies announcement posting to a non-organizer', async () => {
    const response = await request(app)
      .post('/api/announcements')
      .set('Cookie', authCookie('member', MEMBER_ID))
      .send({ title: 'Member post', body: 'This must not be published.' });

    expect(response.status).toBe(403);
  });

  it("denies an organizer editing another organizer's announcement", async () => {
    const createdResponse = await request(app)
      .post('/api/announcements')
      .set('Cookie', authCookie('officer', FIRST_OFFICER_ID))
      .send({ title: 'Original title', body: 'Original body' });
    const created = (createdResponse.body as AnnouncementResponseBody).announcement;

    const editResponse = await request(app)
      .patch(`/api/announcements/${created._id}`)
      .set('Cookie', authCookie('officer', SECOND_OFFICER_ID))
      .send({ title: 'Taken over' });

    expect(createdResponse.status).toBe(201);
    expect(editResponse.status).toBe(403);
    expect((editResponse.body as { message: string }).message).toMatch(/original author/i);
  });
});

describe('announcement ordering', () => {
  it('keeps pinned posts first regardless of date, then sorts newest first', async () => {
    const announcements = fakeDb.collection('announcements');
    const base = {
      clubId: env.CLUB_ID,
      authorId: FIRST_OFFICER_ID,
      body: 'Update body',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    await announcements.insertOne({
      ...base,
      title: 'Newest regular',
      isPinned: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await announcements.insertOne({
      ...base,
      title: 'Older pinned',
      isPinned: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await announcements.insertOne({
      ...base,
      title: 'Older regular',
      isPinned: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const response = await request(app)
      .get('/api/announcements')
      .set('Cookie', authCookie('member', MEMBER_ID));
    const titles = (response.body as AnnouncementListResponseBody).announcements.map(
      (announcement) => announcement.title,
    );

    expect(response.status).toBe(200);
    expect(titles).toEqual(['Older pinned', 'Newest regular', 'Older regular']);
  });
});

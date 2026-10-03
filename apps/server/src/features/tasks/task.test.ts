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
                return (leftValue as number) > (rightValue as number) ? direction : -direction;
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
const MEMBER_ONE_ID = '000000000000000000000010';
const MEMBER_TWO_ID = '000000000000000000000011';
const OFFICER_ID = '000000000000000000000020';

function authCookie(role: AuthUser['role'], userId: string): string {
  const token = signJwt({ userId, role, email: `${userId}@example.com`, displayName: role });
  return `access_token=${token}`;
}

function taskInput(assigneeId: string) {
  return {
    title: 'Set up fundraiser desk',
    description: 'Arrange the check-in table before doors open.',
    status: 'not_started',
    assigneeId,
  };
}

interface TaskResponseBody {
  task: {
    _id: string;
    assigneeId: string | null;
    status: string;
    completedAt?: string;
  };
}

beforeAll(() => {
  app = createApp(env);
});

beforeEach(async () => {
  resetDb();
  const users = fakeDb.collection('users');
  await users.insertOne({
    _id: new ObjectId(MEMBER_ONE_ID),
    displayName: 'First Member',
    role: 'member',
  });
  await users.insertOne({
    _id: new ObjectId(MEMBER_TWO_ID),
    displayName: 'Second Member',
    role: 'member',
  });
  await users.insertOne({
    _id: new ObjectId(OFFICER_ID),
    displayName: 'Club Officer',
    role: 'officer',
  });
});

describe('volunteer task authorization', () => {
  it('denies task creation to a non-organizer', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie('member', MEMBER_ONE_ID))
      .send(taskInput(MEMBER_ONE_ID));

    expect(response.status).toBe(403);
  });

  it("denies a member marking someone else's task done", async () => {
    const createdResponse = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie('officer', OFFICER_ID))
      .send(taskInput(MEMBER_ONE_ID));
    const taskId = (createdResponse.body as TaskResponseBody).task._id;

    const response = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Cookie', authCookie('member', MEMBER_TWO_ID))
      .send({ status: 'done' });

    expect(createdResponse.status).toBe(201);
    expect(response.status).toBe(403);
  });
});

describe('volunteer task status transitions', () => {
  it('allows an assignee to move forward and rejects moving completed work backward', async () => {
    const createdResponse = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie('officer', OFFICER_ID))
      .send(taskInput(MEMBER_ONE_ID));
    const taskId = (createdResponse.body as TaskResponseBody).task._id;
    const memberCookie = authCookie('member', MEMBER_ONE_ID);

    const startedResponse = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Cookie', memberCookie)
      .send({ status: 'in_progress' });
    expect(startedResponse.status).toBe(200);
    expect((startedResponse.body as TaskResponseBody).task.status).toBe('in_progress');

    const doneResponse = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Cookie', memberCookie)
      .send({ status: 'done' });
    expect(doneResponse.status).toBe(200);
    expect((doneResponse.body as TaskResponseBody).task).toMatchObject({
      status: 'done',
      assigneeId: MEMBER_ONE_ID,
    });
    expect((doneResponse.body as TaskResponseBody).task.completedAt).toBeTypeOf('string');

    const backwardResponse = await request(app)
      .patch(`/api/tasks/${taskId}/status`)
      .set('Cookie', memberCookie)
      .send({ status: 'in_progress' });
    expect(backwardResponse.status).toBe(409);
  });
});

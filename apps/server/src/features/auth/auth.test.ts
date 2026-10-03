/**
 * Integration tests for auth endpoints.
 *
 * Tests per AGENTS.md §13:
 *   - Happy path register + login + me
 *   - Wrong credentials (wrong password, non-existent email)
 *   - Duplicate email
 *   - Protected route without token
 *   - Privilege escalation attempt (role in request body)
 *   - Rate limiting trigger (> 10 req / 60 s)
 *
 * External services (MongoDB, Redis) are replaced with in-process fakes so
 * tests are deterministic and do not require real infrastructure.
 */
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// ── Hoisted fakes (must be defined before vi.mock calls) ─────────────────────

const { fakeRedisStore, fakeCollection, resetFakes } = vi.hoisted(() => {
  interface FakeUserDoc {
    _id: { toString(): string; toHexString(): string };
    email: string;
    passwordHash: string;
    displayName: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }

  const fakeUsers = new Map<string, FakeUserDoc>();
  const fakeRedisStore = new Map<string, { count: number; expiresAt: number }>();
  let idCounter = 0;

  function makeId() {
    idCounter++;
    return String(idCounter).padStart(24, '0');
  }

  const fakeCollection = {
    findOne: (
      filter: Record<string, unknown>,
      options?: { projection?: Record<string, unknown> },
    ) => {
      for (const user of fakeUsers.values()) {
        let match = true;

        if ('email' in filter && user.email !== (filter['email'] as string)) match = false;

        if ('_id' in filter) {
          const idFilter = filter['_id'] as Record<string, unknown> | undefined;
          if (idFilter && typeof idFilter === 'object' && !('$exists' in idFilter)) {
            const idStr =
              typeof (idFilter as { toString(): string }).toString === 'function'
                ? (idFilter as { toString(): string }).toString()
                : String(idFilter);
            if (user._id.toString() !== idStr) match = false;
          }
        }

        if ('deletedAt' in filter) {
          const delFilter = filter['deletedAt'] as Record<string, boolean> | undefined;
          if (delFilter && '$exists' in delFilter) {
            const shouldExist = delFilter['$exists'] as boolean;
            if (!shouldExist && user.deletedAt !== undefined) match = false;
            if (shouldExist && user.deletedAt === undefined) match = false;
          }
        }

        if (match) {
          if (options?.projection) {
            const result: Record<string, unknown> = {
              ...(user as unknown as Record<string, unknown>),
            };
            for (const [k, v] of Object.entries(options.projection)) {
              if (v === 0) delete result[k];
            }
            return Promise.resolve(result);
          }
          return Promise.resolve({ ...(user as unknown as Record<string, unknown>) });
        }
      }
      return Promise.resolve(null);
    },

    insertOne: (doc: FakeUserDoc) => {
      const hexId = makeId();
      const id = { toString: () => hexId, toHexString: () => hexId };
      const stored = { ...doc, _id: id } as FakeUserDoc;
      fakeUsers.set(hexId, stored);
      return Promise.resolve({ insertedId: id });
    },

    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      for (const user of fakeUsers.values()) {
        if ('email' in filter && user.email === (filter['email'] as string)) {
          const setOp = (update as { $set: Record<string, unknown> })['$set'];
          Object.assign(user, setOp);
          return Promise.resolve({ matchedCount: 1 });
        }
      }
      return Promise.resolve({ matchedCount: 0 });
    },

    createIndex: () => Promise.resolve({}),
  };

  function resetFakes() {
    fakeUsers.clear();
    fakeRedisStore.clear();
    idCounter = 0;
  }

  return { fakeUsers, fakeRedisStore, fakeCollection, resetFakes };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../redis/client.js', () => ({
  getRedis: () => ({
    incr: async (key: string) => {
      const entry = fakeRedisStore.get(key);
      if (entry === undefined || Date.now() > entry.expiresAt) {
        fakeRedisStore.set(key, { count: 1, expiresAt: Date.now() + 60_000 });
        return 1;
      }
      entry.count++;
      return entry.count;
    },
    expire: async (_key: string, _ttl: number) => {
      /* no-op */
    },
    ttl: async (_key: string) => 60,
  }),
}));

vi.mock('../../db/connection.js', () => ({
  getDb: () => ({
    collection: (_name: string) => fakeCollection,
  }),
}));

vi.mock('mongodb', async () => {
  return {
    ObjectId: class {
      private readonly hexId: string;
      constructor(id?: string) {
        this.hexId = id ?? '000000000000000000000000';
      }
      toString() {
        return this.hexId;
      }
      toHexString() {
        return this.hexId;
      }
      static isValid(id: unknown) {
        return typeof id === 'string' && id.length === 24;
      }
    },
    MongoClient: class {},
  };
});

// ── App under test ───────────────────────────────────────────────────────────

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

let app: Express;

beforeAll(() => {
  app = createApp(env);
});

beforeEach(() => {
  resetFakes();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Registers a test user and returns the response.
 */
async function registerTestUser(
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
) {
  const body = {
    email: overrides.email ?? 'alice@example.com',
    password: overrides.password ?? 'Password123!',
    displayName: overrides.displayName ?? 'Alice',
  };
  return request(app).post('/api/auth/register').send(body);
}

/**
 * Extracts the `access_token` cookie string from a supertest response.
 */
function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((c) => c.startsWith('access_token=')) ?? '';
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 201 with safe profile', async () => {
    const res = await registerTestUser();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('member');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('sets an HTTP-only access_token cookie', async () => {
    const res = await registerTestUser();
    const cookie = extractCookie(res);
    expect(cookie).toContain('access_token=');
    expect(cookie.toLowerCase()).toContain('httponly');
  });

  it('always assigns role=member regardless of body', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'hacker@example.com',
      password: 'Password123!',
      displayName: 'Hacker',
      role: 'admin', // privilege escalation attempt
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('member');
  });

  it('returns 409 for duplicate email', async () => {
    await registerTestUser();
    const res = await registerTestUser(); // same email
    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for a password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@example.com',
      password: 'abc',
      displayName: 'Short',
    });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerTestUser();
  });

  it('returns 200 and sets cookie for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(extractCookie(res)).toContain('access_token=');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).not.toContain('hash');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(401);
  });

  it('returns the same 401 message for wrong password and unknown email', async () => {
    const wrongPw = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrong',
    });
    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password123!',
    });
    expect(wrongPw.body.message).toBe(unknownEmail.body.message);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when no cookie is present', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the safe user profile when authenticated', async () => {
    const registerRes = await registerTestUser();
    const cookie = extractCookie(registerRes);

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('passwordResetTokenHash');
  });

  it('returns 401 for a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'access_token=definitely.not.a.valid.jwt');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the cookie', async () => {
    const registerRes = await registerTestUser();
    const cookie = extractCookie(registerRes);

    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const clearHeader = logoutRes.headers['set-cookie'] as string[] | undefined;
    expect(clearHeader).toBeDefined();
    const clearCookie = (clearHeader ?? []).find((c) => c.startsWith('access_token='));
    expect(clearCookie).toBeDefined();
    expect(clearCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});

describe('Rate limiting', () => {
  it('returns 429 after exceeding 10 login attempts per minute', async () => {
    await registerTestUser();

    let lastStatus = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'alice@example.com',
        password: 'wrong',
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('returns 429 after exceeding 10 register attempts per minute', async () => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `user${attempt.toString()}@example.com`,
          password: 'Password123!',
          displayName: `User ${attempt.toString()}`,
        });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

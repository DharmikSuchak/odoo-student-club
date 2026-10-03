import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
          const idFilter = filter['_id'] as { toString(): string } | undefined;
          if (idFilter !== undefined && typeof idFilter === 'object' && !('$exists' in idFilter)) {
            const idStr = idFilter.toString();
            if (user._id.toString() !== idStr) match = false;
          }
        }

        if ('deletedAt' in filter) {
          const delFilter = filter['deletedAt'] as Record<string, boolean> | undefined;
          if (delFilter !== undefined && '$exists' in delFilter) {
            const shouldExist = delFilter['$exists'];
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
      const stored = { ...doc, _id: id };
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

vi.mock('../../redis/client.js', () => ({
  getRedis: () => ({
    incr: (key: string) => {
      const entry = fakeRedisStore.get(key);
      if (entry === undefined || Date.now() > entry.expiresAt) {
        fakeRedisStore.set(key, { count: 1, expiresAt: Date.now() + 60_000 });
        return Promise.resolve(1);
      }
      entry.count++;
      return Promise.resolve(entry.count);
    },
    expire: (_key: string, _ttl: number) => Promise.resolve(true),
    ttl: (_key: string) => Promise.resolve(60),
  }),
}));

vi.mock('../../db/connection.js', () => ({
  getDb: () => ({
    collection: (_name: string) => fakeCollection,
  }),
}));

vi.mock('mongodb', () => {
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

interface RegisterBody {
  email?: string;
  password?: string;
  displayName?: string;
}

async function registerTestUser(overrides: Partial<RegisterBody> = {}) {
  const body = {
    email: overrides.email ?? 'alice@example.com',
    password: overrides.password ?? 'Password123!',
    displayName: overrides.displayName ?? 'Alice',
  };
  return request(app).post('/api/auth/register').send(body);
}

function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((c) => c.startsWith('access_token=')) ?? '';
}

interface ResponseBody {
  status: string;
  user?: {
    email: string;
    role: string;
    passwordHash?: string;
    passwordResetTokenHash?: string;
  };
  message?: string;
}

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 201 with safe profile', async () => {
    const res = await registerTestUser();
    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.status).toBe('ok');
    expect(body.user?.email).toBe('alice@example.com');
    expect(body.user?.role).toBe('member');
    expect(body.user).not.toHaveProperty('passwordHash');
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
      role: 'admin',
    });
    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.user?.role).toBe('member');
  });

  it('returns 409 for duplicate email', async () => {
    await registerTestUser();
    const res = await registerTestUser();
    expect(res.status).toBe(409);
    const body = res.body as ResponseBody;
    expect(body.status).toBe('error');
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
    const body = res.body as ResponseBody;
    expect(body.user?.email).toBe('alice@example.com');
    expect(extractCookie(res)).toContain('access_token=');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
    const body = res.body as ResponseBody;
    expect(body.message).not.toContain('hash');
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
    const bodyA = wrongPw.body as ResponseBody;
    const bodyB = unknownEmail.body as ResponseBody;
    expect(bodyA.message).toBe(bodyB.message);
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
    const body = res.body as ResponseBody;
    expect(body.user?.email).toBe('alice@example.com');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('passwordResetTokenHash');
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

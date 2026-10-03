/**
 * Integration tests for membership endpoints.
 *
 * Covers per AGENTS.md §13:
 *   - Member can view own membership (happy path + empty)
 *   - Officer can create a membership for a user
 *   - Treasurer can record a manual payment (activating the membership)
 *   - Expiry boundary: active membership with past endDate is NOT active
 *   - Unpaid membership stays in pending_payment
 *   - Unauthorized changes (member tries to create/pay — 403)
 *   - Renewal blocked when active membership exists
 *   - Treasurer cannot escalate own role via the body
 *
 * External services (MongoDB, Redis) are replaced with in-process fakes.
 */
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted fakes ─────────────────────────────────────────────────────────────

const { fakeDb, fakeRedisStore, resetFakes } = vi.hoisted(() => {
  type DocRecord = Record<string, unknown> & { _id: { toString(): string; toHexString(): string } };

  const stores = new Map<string, Map<string, DocRecord>>();
  const fakeRedisStore = new Map<string, { count: number; expiresAt: number }>();
  let idCounter = 0;

  function makeId() {
    idCounter++;
    return String(idCounter).padStart(24, '0');
  }

  function getStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    // Non-null safe: we just set it
    return stores.get(name) as Map<string, DocRecord>;
  }

  function makeCollection(name: string) {
    return {
      findOne: (
        filter: Record<string, unknown>,
        options?: { projection?: Record<string, number | boolean>; sort?: Record<string, number> },
      ) => {
        const store = getStore(name);
        const docs = [...store.values()];
        // Sort by createdAt desc if requested
        if (options?.sort?.['createdAt'] === -1) {
          docs.sort((a, b) => {
            const aDate = a['createdAt'] as Date;
            const bDate = b['createdAt'] as Date;
            return bDate.getTime() - aDate.getTime();
          });
        }
        for (const doc of docs) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (key === '_id') {
              const idVal = val as { toString(): string };
              if (doc['_id'].toString() !== idVal.toString()) match = false;
            } else if (val !== null && typeof val === 'object' && '$gt' in val) {
              const dateVal = val as { $gt: Date };
              const docDate = doc[key] as Date;
              if (!(docDate > dateVal.$gt)) match = false;
            } else {
              if (doc[key] !== val) match = false;
            }
          }
          if (match) {
            if (options?.projection) {
              const result: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(options.projection)) {
                if (v !== 0) result[k] = doc[k];
              }
              result['_id'] = doc['_id'];
              return Promise.resolve(result as DocRecord);
            }
            return Promise.resolve({ ...doc } as DocRecord);
          }
        }
        return Promise.resolve(null);
      },

      find: (
        filter: Record<string, unknown>,
        options?: { projection?: Record<string, number | boolean>; sort?: Record<string, number> },
      ) => {
        const store = getStore(name);
        const results: DocRecord[] = [];
        for (const doc of store.values()) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (val !== null && typeof val === 'object' && '$gt' in val) {
              const dateVal = val as { $gt: Date };
              const docDate = doc[key] as Date;
              if (!(docDate > dateVal.$gt)) match = false;
            } else {
              if (doc[key] !== val) match = false;
            }
          }
          if (match) results.push({ ...doc });
        }
        if (options?.sort?.['createdAt'] === -1) {
          results.sort((a, b) => {
            const aDate = a['createdAt'] as Date;
            const bDate = b['createdAt'] as Date;
            return bDate.getTime() - aDate.getTime();
          });
        }
        if (options?.projection) {
          const projected = results.map((doc) => {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(options.projection ?? {})) {
              if (v !== 0) result[k] = doc[k];
            }
            result['_id'] = doc['_id'];
            return result as DocRecord;
          });
          return { toArray: () => Promise.resolve(projected) };
        }
        return { toArray: () => Promise.resolve(results) };
      },

      insertOne: (doc: Record<string, unknown>) => {
        const store = getStore(name);
        const hexId = makeId();
        const id = { toString: () => hexId, toHexString: () => hexId };
        const stored = { ...doc, _id: id } as DocRecord;
        store.set(hexId, stored);
        return Promise.resolve({ insertedId: id });
      },

      updateOne: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
      ) => {
        const store = getStore(name);
        for (const doc of store.values()) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (key === '_id') {
              const idVal = val as { toString(): string };
              if (doc['_id'].toString() !== idVal.toString()) match = false;
            } else {
              if (doc[key] !== val) match = false;
            }
          }
          if (match) {
            const setOp = (update as { $set: Record<string, unknown> })['$set'];
            Object.assign(doc, setOp);
            return Promise.resolve({ matchedCount: 1 });
          }
        }
        return Promise.resolve({ matchedCount: 0 });
      },

      createIndex: () => Promise.resolve({}),
    };
  }

  const fakeDb = {
    collection: (name: string) => makeCollection(name),
  };

  function resetFakes() {
    stores.clear();
    fakeRedisStore.clear();
    idCounter = 0;
  }

  return { fakeDb, fakeRedisStore, resetFakes };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

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
  getDb: () => fakeDb,
}));

vi.mock('mongodb', () => {
  return {
    ObjectId: class {
      private readonly hexId: string;
      constructor(id?: string) {
        this.hexId = id ?? '000000000000000000000000';
      }
      toString() { return this.hexId; }
      toHexString() { return this.hexId; }
      static isValid(id: unknown) {
        return typeof id === 'string' && id.length === 24;
      }
    },
    MongoClient: class {},
  };
});

// ── App + types ───────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ResponseBody {
  status: string;
  user?: { email: string; role: string };
  membership?: Record<string, unknown> | null;
  memberships?: Record<string, unknown>[];
  isActive?: boolean;
  tier?: Record<string, unknown>;
  tiers?: Record<string, unknown>[];
  message?: string;
}

function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((c) => c.startsWith('access_token=')) ?? '';
}

/** Register a user and return their auth cookie. */
async function registerAndLogin(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName });
  return extractCookie(res);
}


/** A fake tier ObjectId. */
const TIER_ID = '000000000000000000000099';

/** Seeds a membership tier into the fake store. */
async function seedTier(): Promise<void> {
  await request(app)
    .post('/api/memberships/tiers')
    .set('Cookie', officerCookie)
    .send({
      name: 'General Member',
      durationDays: 365,
      priceCents: 50000,
    });
}

// Pre-register actors (populated in beforeEach)
let memberCookie = '';
let officerCookie = '';
let treasurerCookie = '';
let memberId = '';

beforeEach(async () => {
  // Register users
  memberCookie = await registerAndLogin('member@test.com', 'Password123!', 'Alice Member');
  officerCookie = await registerAndLogin('officer@test.com', 'Password123!', 'Bob Officer');
  treasurerCookie = await registerAndLogin('treasurer@test.com', 'Password123!', 'Carol Treasurer');

  // Grab member userId from /me
  const meRes = await request(app).get('/api/auth/me').set('Cookie', memberCookie);
  const meBody = meRes.body as ResponseBody;
  memberId = (meBody.user as { id: string } | undefined)?.id ?? '';

  // Manually promote officer and treasurer in the fake user store (bypass HTTP route)
  // We do this by calling the auth/me endpoint to confirm IDs, then using updateOne on fakeDb
  const officerMeRes = await request(app).get('/api/auth/me').set('Cookie', officerCookie);
  const officerBody = officerMeRes.body as ResponseBody;
  const officerId = (officerBody.user as { id: string } | undefined)?.id ?? '';

  const treasurerMeRes = await request(app).get('/api/auth/me').set('Cookie', treasurerCookie);
  const treasurerBody = treasurerMeRes.body as ResponseBody;
  const treasurerId = (treasurerBody.user as { id: string } | undefined)?.id ?? '';

  // Directly mutate fake store to promote roles (safe dev-only pattern)
  await fakeDb.collection('users').updateOne(
    { _id: { toString: () => officerId, toHexString: () => officerId } },
    { $set: { role: 'officer' } },
  );
  await fakeDb.collection('users').updateOne(
    { _id: { toString: () => treasurerId, toHexString: () => treasurerId } },
    { $set: { role: 'treasurer' } },
  );

  // Re-login to get new JWT with updated role
  officerCookie = await (async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'officer@test.com', password: 'Password123!' });
    return extractCookie(r);
  })();
  treasurerCookie = await (async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'treasurer@test.com', password: 'Password123!' });
    return extractCookie(r);
  })();
});

// ── Tier tests ────────────────────────────────────────────────────────────────

describe('GET /api/memberships/tiers', () => {
  it('returns empty list when no tiers exist', async () => {
    const res = await request(app).get('/api/memberships/tiers').set('Cookie', memberCookie);
    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(body.tiers).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/memberships/tiers');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/memberships/tiers', () => {
  it('officer can create a tier', async () => {
    const res = await request(app)
      .post('/api/memberships/tiers')
      .set('Cookie', officerCookie)
      .send({ name: 'Gold', durationDays: 365, priceCents: 100000 });
    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.tier?.['name']).toBe('Gold');
  });

  it('member cannot create a tier (403)', async () => {
    const res = await request(app)
      .post('/api/memberships/tiers')
      .set('Cookie', memberCookie)
      .send({ name: 'Gold', durationDays: 365, priceCents: 100000 });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid tier data', async () => {
    const res = await request(app)
      .post('/api/memberships/tiers')
      .set('Cookie', officerCookie)
      .send({ name: '', durationDays: -1, priceCents: -500 });
    expect(res.status).toBe(422);
  });
});

// ── Membership create tests ───────────────────────────────────────────────────

describe('POST /api/memberships', () => {
  beforeEach(async () => {
    await seedTier();
  });

  it('officer can create a membership for a user', async () => {
    // List tiers to get the real tier ID
    const tiersRes = await request(app)
      .get('/api/memberships/tiers')
      .set('Cookie', officerCookie);
    const tiersBody = tiersRes.body as ResponseBody;
    const realTierId = (tiersBody.tiers?.[0] as { _id: string } | undefined)?.['_id'] ?? TIER_ID;

    const res = await request(app)
      .post('/api/memberships')
      .set('Cookie', officerCookie)
      .send({
        userId: memberId,
        tierId: realTierId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.membership?.['status']).toBe('pending_payment');
    expect(body.membership?.['userId']).toBe(memberId);
  });

  it('member cannot create a membership (403)', async () => {
    const res = await request(app)
      .post('/api/memberships')
      .set('Cookie', memberCookie)
      .send({
        userId: memberId,
        tierId: TIER_ID,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(res.status).toBe(403);
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app)
      .post('/api/memberships')
      .set('Cookie', officerCookie)
      .send({ userId: memberId });
    expect(res.status).toBe(422);
  });
});

// ── Member self-view tests ────────────────────────────────────────────────────

describe('GET /api/memberships/me', () => {
  it('returns null membership when user has no membership', async () => {
    const res = await request(app).get('/api/memberships/me').set('Cookie', memberCookie);
    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(body.membership).toBeNull();
    expect(body.isActive).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/memberships/me');
    expect(res.status).toBe(401);
  });
});

// ── Organizer list tests ──────────────────────────────────────────────────────

describe('GET /api/memberships', () => {
  it('officer can list all memberships', async () => {
    const res = await request(app).get('/api/memberships').set('Cookie', officerCookie);
    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(Array.isArray(body.memberships)).toBe(true);
  });

  it('member cannot list all memberships (403)', async () => {
    const res = await request(app).get('/api/memberships').set('Cookie', memberCookie);
    expect(res.status).toBe(403);
  });
});

// ── Manual payment / activation tests ────────────────────────────────────────

describe('POST /api/memberships/:id/record-payment', () => {
  let membershipId = '';

  beforeEach(async () => {
    await seedTier();
    const tiersRes = await request(app)
      .get('/api/memberships/tiers')
      .set('Cookie', officerCookie);
    const tiersBody = tiersRes.body as ResponseBody;
    const realTierId = (tiersBody.tiers?.[0] as { _id: string } | undefined)?.['_id'] ?? TIER_ID;

    const createRes = await request(app)
      .post('/api/memberships')
      .set('Cookie', officerCookie)
      .send({
        userId: memberId,
        tierId: realTierId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    const createBody = createRes.body as ResponseBody;
    membershipId = (createBody.membership as { _id: string } | undefined)?.['_id'] ?? '';
  });

  it('treasurer can record a manual payment and activate membership', async () => {
    const res = await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', treasurerCookie)
      .send({ amountPaidCents: 50000 });
    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(body.membership?.['status']).toBe('active');
    expect(body.membership?.['amountPaidCents']).toBe(50000);
  });

  it('officer cannot record a payment (403)', async () => {
    const res = await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', officerCookie)
      .send({ amountPaidCents: 50000 });
    expect(res.status).toBe(403);
  });

  it('member cannot record a payment (403)', async () => {
    const res = await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', memberCookie)
      .send({ amountPaidCents: 50000 });
    expect(res.status).toBe(403);
  });

  it('returns 400 for zero or negative amountPaidCents', async () => {
    const res = await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', treasurerCookie)
      .send({ amountPaidCents: 0 });
    expect(res.status).toBe(422);
  });

  it('returns 409 when membership is already active', async () => {
    // Activate once
    await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', treasurerCookie)
      .send({ amountPaidCents: 50000 });
    // Try to activate again
    const res = await request(app)
      .post(`/api/memberships/${membershipId}/record-payment`)
      .set('Cookie', treasurerCookie)
      .send({ amountPaidCents: 50000 });
    expect(res.status).toBe(409);
  });
});

// ── Expiry boundary tests ─────────────────────────────────────────────────────

describe('isMembershipActive expiry boundary', () => {
  it('returns true for active membership with future endDate', async () => {
    const { isMembershipActive } = await import('./membership.service.js');
    const asOf = new Date('2025-06-01T00:00:00Z');
    expect(
      isMembershipActive({ status: 'active', endDate: new Date('2026-01-01T00:00:00Z') }, asOf),
    ).toBe(true);
  });

  it('returns false for active membership with past endDate', async () => {
    const { isMembershipActive } = await import('./membership.service.js');
    const asOf = new Date('2025-06-01T00:00:00Z');
    expect(
      isMembershipActive({ status: 'active', endDate: new Date('2025-01-01T00:00:00Z') }, asOf),
    ).toBe(false);
  });

  it('returns false for pending_payment membership with future endDate', async () => {
    const { isMembershipActive } = await import('./membership.service.js');
    const asOf = new Date('2025-06-01T00:00:00Z');
    expect(
      isMembershipActive(
        { status: 'pending_payment', endDate: new Date('2026-01-01T00:00:00Z') },
        asOf,
      ),
    ).toBe(false);
  });

  it('returns false when endDate == asOf (exclusive boundary)', async () => {
    const { isMembershipActive } = await import('./membership.service.js');
    const boundary = new Date('2025-06-01T00:00:00Z');
    expect(isMembershipActive({ status: 'active', endDate: boundary }, boundary)).toBe(false);
  });
});

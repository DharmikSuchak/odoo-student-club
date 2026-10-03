import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fakeDb, fakeRedisStore, resetFakes } = vi.hoisted(() => {
  type DocRecord = Record<string, unknown> & {
    _id: { toString(): string; toHexString(): string };
  };

  const stores = new Map<string, Map<string, DocRecord>>();
  const fakeRedisStore = new Map<string, { count: number; expiresAt: number }>();
  let idCounter = 0;

  function makeId() {
    idCounter++;
    return String(idCounter).padStart(24, '0');
  }

  function getStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name) as Map<string, DocRecord>;
  }

  function makeCollection(name: string) {
    return {
      findOne: (
        filter: Record<string, unknown>,
        options?: { projection?: Record<string, number> },
      ) => {
        const store = getStore(name);
        for (const doc of store.values()) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (key === '_id') {
              const idVal = val as { toString(): string };
              if (doc['_id'].toString() !== idVal.toString()) match = false;
            } else if (val !== null && typeof val === 'object' && '$exists' in val) {
              const existsOp = (val as { $exists: boolean })['$exists'];
              if (!existsOp && key in doc) match = false;
              if (existsOp && !(key in doc)) match = false;
            } else if (val !== null && typeof val === 'object' && '$elemMatch' in val) {
              const elemMatch = (val as { $elemMatch: Record<string, unknown> })['$elemMatch'];
              const arr = doc[key] as Array<Record<string, unknown>>;
              if (!Array.isArray(arr)) {
                match = false;
              } else {
                const hasMatch = arr.some((item) => {
                  for (const [ek, ev] of Object.entries(elemMatch)) {
                    if (ev !== null && typeof ev === 'object' && '$gt' in ev) {
                      const num = ev as { $gt: number };
                      if (!((item[ek] as number) > num.$gt)) return false;
                    } else {
                      if (item[ek] !== ev) return false;
                    }
                  }
                  return true;
                });
                if (!hasMatch) match = false;
              }
            } else {
              if (doc[key] !== val) match = false;
            }
          }
          if (match) {
            const resultDoc = { ...doc } as DocRecord;
            if (options?.projection) {
              const isExclusion = Object.values(options.projection).some((v) => v === 0);
              const projected = isExclusion
                ? { ...resultDoc }
                : ({ _id: resultDoc['_id'] } as Record<string, unknown>);

              for (const [k, v] of Object.entries(options.projection)) {
                if (v === 0) {
                  delete projected[k];
                } else if (v === 1) {
                  projected[k] = resultDoc[k];
                }
              }
              return Promise.resolve(projected as DocRecord);
            }
            return Promise.resolve(resultDoc);
          }
        }
        return Promise.resolve(null);
      },

      find: (filter: Record<string, unknown>, options?: { sort?: Record<string, number> }) => {
        const store = getStore(name);
        const results: DocRecord[] = [];
        for (const doc of store.values()) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (doc[key] !== val) match = false;
          }
          if (match) results.push({ ...doc });
        }
        if (options?.sort?.['name'] === 1) {
          results.sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
        }
        if (options?.sort?.['createdAt'] === -1) {
          results.sort((a, b) => {
            const aDate = a['createdAt'] as Date;
            const bDate = b['createdAt'] as Date;
            return bDate.getTime() - aDate.getTime();
          });
        }
        return { toArray: () => Promise.resolve(results) };
      },

      insertOne: (doc: Record<string, unknown>, _options?: unknown) => {
        const store = getStore(name);
        const hexId = makeId();
        const id = { toString: () => hexId, toHexString: () => hexId, toJSON: () => hexId };
        const stored = { ...doc, _id: id } as DocRecord;
        store.set(hexId, stored);
        return Promise.resolve({ insertedId: id });
      },

      findOneAndUpdate: (
        filter: Record<string, unknown>,
        update: Record<string, unknown>,
        options?: { returnDocument?: string; session?: unknown },
      ) => {
        const store = getStore(name);
        for (const doc of store.values()) {
          let match = true;
          for (const [key, val] of Object.entries(filter)) {
            if (key === '_id') {
              const idVal = val as { toString(): string };
              if (doc['_id'].toString() !== idVal.toString()) match = false;
            } else if (val !== null && typeof val === 'object' && '$elemMatch' in val) {
              const elemMatch = (val as { $elemMatch: Record<string, unknown> })['$elemMatch'];
              const arr = doc[key] as Array<Record<string, unknown>>;
              if (!Array.isArray(arr)) {
                match = false;
              } else {
                const hasMatch = arr.some((item) => {
                  for (const [ek, ev] of Object.entries(elemMatch)) {
                    if (ev !== null && typeof ev === 'object' && '$gt' in ev) {
                      const num = ev as { $gt: number };
                      if (!((item[ek] as number) > num.$gt)) return false;
                    } else {
                      if (item[ek] !== ev) return false;
                    }
                  }
                  return true;
                });
                if (!hasMatch) match = false;
              }
            } else {
              if (doc[key] !== val) match = false;
            }
          }
          if (match) {
            const incOp = (update as { $inc?: Record<string, number> })['$inc'];
            if (incOp !== undefined) {
              for (const [incPath, incVal] of Object.entries(incOp)) {
                if (incPath === 'variants.$.stockQuantity') {
                  const filterVariant = (
                    filter['variants'] as { $elemMatch: Record<string, unknown> }
                  )?.['$elemMatch'] as Record<string, unknown> | undefined;
                  if (filterVariant !== undefined) {
                    const variantSize = filterVariant['size'] as string;
                    const variants = doc['variants'] as Array<Record<string, unknown>>;
                    const variantIdx = variants.findIndex((v) => v['size'] === variantSize);
                    if (variantIdx !== -1) {
                      const v = variants[variantIdx];
                      if (v !== undefined) {
                        v['stockQuantity'] = (v['stockQuantity'] as number) + incVal;
                      }
                    }
                  }
                } else {
                  doc[incPath] = ((doc[incPath] as number) ?? 0) + incVal;
                }
              }
            }
            const setOp = (update as { $set?: Record<string, unknown> })['$set'];
            if (setOp !== undefined) {
              for (const [setKey, setVal] of Object.entries(setOp)) {
                doc[setKey] = setVal;
              }
            }
            if (options?.returnDocument === 'after') {
              return Promise.resolve({ ...doc } as DocRecord);
            }
            return Promise.resolve({ ...doc } as DocRecord);
          }
        }
        return Promise.resolve(null);
      },

      updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
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
    client: {
      startSession: () => ({
        withTransaction: async (fn: () => Promise<unknown>) => fn(),
        endSession: () => Promise.resolve(),
      }),
    },
    collection: (name: string) => makeCollection(name),
  };

  function resetFakes() {
    stores.clear();
    fakeRedisStore.clear();
    idCounter = 0;
  }

  return { fakeDb, fakeRedisStore, resetFakes };
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
  getDb: () => fakeDb,
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

interface ProductBody {
  _id?: string;
  name?: string;
  priceCents?: number;
  currency?: string;
  variants?: Array<{ size: string; stockQuantity: number }>;
}

interface ResponseBody {
  status: string;
  product?: ProductBody;
  products?: ProductBody[];
  order?: Record<string, unknown>;
  orders?: Record<string, unknown>[];
  message?: string;
}

function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.find((c) => c.startsWith('access_token=')) ?? '';
}

async function registerAndLogin(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName });
  if (res.status >= 400) {
    throw new Error(`Register failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return extractCookie(res);
}

async function promoteRole(
  cookie: string,
  role: 'officer' | 'treasurer' | 'admin',
): Promise<string> {
  const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
  if (meRes.status >= 400) {
    throw new Error(`GET /me failed with ${meRes.status}: ${JSON.stringify(meRes.body)}`);
  }
  const userId = (meRes.body as { user: { id: string } }).user.id;
  await fakeDb
    .collection('users')
    .updateOne({ _id: { toString: () => userId, toHexString: () => userId } }, { $set: { role } });
  const emailMatch = /@/.test(cookie) ? cookie : '';
  void emailMatch;
  const emailAddr = (meRes.body as { user: { email: string } }).user.email;
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: emailAddr, password: 'Password123!' });
  if (loginRes.status >= 400) {
    throw new Error(`Login failed with ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }
  return extractCookie(loginRes);
}

const VALID_PRODUCT = {
  name: 'Club Hoodie',
  priceCents: 2500,
  currency: 'INR',
  variants: [
    { size: 'S', stockQuantity: 10 },
    { size: 'M', stockQuantity: 5 },
    { size: 'L', stockQuantity: 0 },
  ],
};

let memberCookie = '';
let officerCookie = '';

beforeEach(async () => {
  memberCookie = await registerAndLogin('member@store.test', 'Password123!', 'Alice Member');
  officerCookie = await registerAndLogin('officer@store.test', 'Password123!', 'Bob Officer');
  officerCookie = await promoteRole(officerCookie, 'officer');
});

describe('POST /api/store/products', () => {
  it('officer can create a product', async () => {
    const res = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send(VALID_PRODUCT);

    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.status).toBe('ok');
    expect(body.product?.name).toBe('Club Hoodie');
    expect(body.product?.priceCents).toBe(2500);
    expect(Array.isArray(body.product?.variants)).toBe(true);
  });

  it('member (non-officer) cannot create a product — server returns 403', async () => {
    const res = await request(app)
      .post('/api/store/products')
      .set('Cookie', memberCookie)
      .send(VALID_PRODUCT);

    expect(res.status).toBe(403);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).post('/api/store/products').send(VALID_PRODUCT);

    expect(res.status).toBe(401);
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send({ name: '', variants: [] });

    expect(res.status).toBe(422);
  });

  it('returns 422 for negative price', async () => {
    const res = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send({ ...VALID_PRODUCT, priceCents: -100 });

    expect(res.status).toBe(422);
  });

  it('returns 422 for duplicate size variants', async () => {
    const res = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send({
        ...VALID_PRODUCT,
        variants: [
          { size: 'M', stockQuantity: 5 },
          { size: 'M', stockQuantity: 3 },
        ],
      });

    expect(res.status).toBe(422);
  });
});

describe('GET /api/store/products', () => {
  it('authenticated member can list products', async () => {
    await request(app).post('/api/store/products').set('Cookie', officerCookie).send(VALID_PRODUCT);

    const res = await request(app).get('/api/store/products').set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(Array.isArray(body.products)).toBe(true);
    expect((body.products ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/store/products');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/store/products/:id', () => {
  it('returns product detail for authenticated user', async () => {
    const createRes = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send(VALID_PRODUCT);
    const productId = (createRes.body as ResponseBody).product?._id ?? '';

    const res = await request(app)
      .get(`/api/store/products/${productId}`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(body.product?.name).toBe('Club Hoodie');
  });

  it('returns 404 for unknown product id', async () => {
    const res = await request(app)
      .get('/api/store/products/000000000000000099999999')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/store/orders', () => {
  let productId: string;

  beforeEach(async () => {
    const createRes = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send(VALID_PRODUCT);
    productId = (createRes.body as ResponseBody).product?._id ?? '';
  });

  it('member can place an order for an in-stock size', async () => {
    const res = await request(app)
      .post('/api/store/orders')
      .set('Cookie', memberCookie)
      .send({ itemId: productId, size: 'S' });

    expect(res.status).toBe(201);
    const body = res.body as ResponseBody;
    expect(body.status).toBe('ok');
    expect(body.order?.['status']).toBe('pending_payment');
    expect(body.order?.['size']).toBe('S');
    expect(body.order?.['itemName']).toBe('Club Hoodie');
  });

  it('order for a size with zero stock returns 409 (out of stock)', async () => {
    const res = await request(app)
      .post('/api/store/orders')
      .set('Cookie', memberCookie)
      .send({ itemId: productId, size: 'L' });

    expect(res.status).toBe(409);
    const body = res.body as ResponseBody;
    expect(body.message).toMatch(/out of stock/i);
  });

  it('order for a nonexistent size returns 409 (not found on product)', async () => {
    const res = await request(app)
      .post('/api/store/orders')
      .set('Cookie', memberCookie)
      .send({ itemId: productId, size: 'XXL' });

    expect(res.status).toBe(409);
    const body = res.body as ResponseBody;
    expect(body.message).toMatch(/not offered|out of stock/i);
  });

  it('unauthenticated order returns 401', async () => {
    const res = await request(app).post('/api/store/orders').send({ itemId: productId, size: 'S' });

    expect(res.status).toBe(401);
  });

  it('simultaneous orders for the last unit — only one succeeds', async () => {
    const singleStockRes = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send({
        name: 'Last-Unit Tee',
        priceCents: 1000,
        currency: 'INR',
        variants: [{ size: 'M', stockQuantity: 1 }],
      });
    const singleId = (singleStockRes.body as ResponseBody).product?._id ?? '';

    const member2Cookie = await registerAndLogin(
      'member2@store.test',
      'Password123!',
      'Carol Second',
    );

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/store/orders')
        .set('Cookie', memberCookie)
        .send({ itemId: singleId, size: 'M' }),
      request(app)
        .post('/api/store/orders')
        .set('Cookie', member2Cookie)
        .send({ itemId: singleId, size: 'M' }),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });
});

describe('GET /api/store/orders/mine', () => {
  it('returns empty list when no orders placed', async () => {
    const res = await request(app).get('/api/store/orders/mine').set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders).toHaveLength(0);
  });

  it('returns placed orders for the authenticated user', async () => {
    const createRes = await request(app)
      .post('/api/store/products')
      .set('Cookie', officerCookie)
      .send(VALID_PRODUCT);
    const productId = (createRes.body as ResponseBody).product?._id ?? '';

    await request(app)
      .post('/api/store/orders')
      .set('Cookie', memberCookie)
      .send({ itemId: productId, size: 'S' });

    const res = await request(app).get('/api/store/orders/mine').set('Cookie', memberCookie);

    expect(res.status).toBe(200);
    const body = res.body as ResponseBody;
    expect((body.orders ?? []).length).toBe(1);
    expect(body.orders?.[0]?.['status']).toBe('pending_payment');
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/store/orders/mine');
    expect(res.status).toBe(401);
  });
});

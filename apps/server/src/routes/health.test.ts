import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { env } from '../config/env.js';

let app: Express;

beforeAll(() => {
  app = createApp(env);
});

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('includes uptime and timestamp fields', async () => {
    const res = await request(app).get('/api/health');
    const body = res.body as { uptime: number; timestamp: string };
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
  });
});

describe('unknown routes', () => {
  it('returns 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'error' });
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

// Env vars are injected by vitest.config.ts before this file is loaded.
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
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
    // Timestamp must be a valid ISO 8601 date
    expect(() => new Date(res.body.timestamp as string)).not.toThrow();
  });
});

describe('unknown routes', () => {
  it('returns 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'error' });
  });
});

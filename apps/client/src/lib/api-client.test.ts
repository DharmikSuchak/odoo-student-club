import { describe, expect, it } from 'vitest';

import { fetchApiHealth } from '../lib/api-client.ts';

// This test file verifies the module exports the expected shape
// without making real network calls.
describe('api-client module', () => {
  it('exports fetchApiHealth as a function', () => {
    expect(typeof fetchApiHealth).toBe('function');
  });
});

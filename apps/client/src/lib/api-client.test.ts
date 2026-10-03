import { describe, expect, it } from 'vitest';

import { fetchApiHealth } from '../lib/api-client';

describe('api-client module', () => {
  it('exports fetchApiHealth as a function', () => {
    expect(typeof fetchApiHealth).toBe('function');
  });
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Inject env vars before any test file or module is loaded.
    // These values are safe placeholder stubs — no real credentials.
    env: {
      NODE_ENV: 'test',
      CLIENT_ORIGIN: 'http://localhost:5173',
      MONGO_URI: 'mongodb://localhost:27017/test?replicaSet=rs0',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test_secret_that_is_long_enough_for_zod_32chars_xx',
      JWT_EXPIRES_IN: '1h',
      PORT: '3001',
      COOKIE_SECRET: 'test_cookie_secret_that_is_long_enough_32chars_xx',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});

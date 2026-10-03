import { z } from 'zod';

/**
 * Validates all required environment variables at startup.
 * The process exits immediately with a descriptive message if any variable
 * is missing or malformed — before any request is handled.
 *
 * See AGENTS.md §6 (Secrets and Configuration).
 */
const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/, 'PORT must be a numeric string').default('3001'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().url('CLIENT_ORIGIN must be a valid URL'),
  MONGO_URI: z.string().url('MONGO_URI must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error('❌  Environment validation failed:\n' + issues);
    console.error('\nCopy .env.example to .env and fill in the required values.');
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;

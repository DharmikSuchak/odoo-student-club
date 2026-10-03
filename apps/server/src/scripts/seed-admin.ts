/**
 * Dev-only seed script: creates the first administrator account.
 *
 * Usage:
 *   npx tsx src/scripts/seed-admin.ts
 *
 * Set the following env vars (or copy .env to .env):
 *   MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 *
 * The script is idempotent: running it twice promotes an existing member
 * or skips if the role is already admin.
 *
 * AGENTS.md §11: roles are NEVER accepted from HTTP requests.
 * This script is the ONLY documented, safe way to create the first admin.
 *
 * ⚠️  Do NOT expose this script via any HTTP route.
 */
import 'dotenv/config';

import { connectDb, closeDb, getDb } from '../db/connection.js';
import { registerUser, promoteToAdmin } from '../features/auth/auth.service.js';

const MONGO_URI =
  process.env['MONGO_URI'] ?? 'mongodb://localhost:27017/student_club?replicaSet=rs0';
const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'];
const ADMIN_NAME = process.env['SEED_ADMIN_NAME'] ?? 'Club Admin';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('❌  SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment.');
  console.error(
    '    Example: SEED_ADMIN_EMAIL=admin@club.example SEED_ADMIN_PASSWORD=S3cur3! npx tsx src/scripts/seed-admin.ts',
  );
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 8) {
  console.error('❌  SEED_ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

// Guaranteed non-null by the guards above
const adminEmail = ADMIN_EMAIL;
const adminPassword = ADMIN_PASSWORD;

async function run(): Promise<void> {
  await connectDb(MONGO_URI);
  const users = getDb().collection('users');

  const existing = await users.findOne({ email: adminEmail.toLowerCase() });

  if (existing === null) {
    console.info(`Creating admin account for ${adminEmail}…`);
    await registerUser(users, {
      email: adminEmail,
      password: adminPassword,
      displayName: ADMIN_NAME,
    });
    console.info('  ✅ User created.');
  } else {
    console.info(`Account ${adminEmail} already exists — skipping create.`);
  }

  await promoteToAdmin(users, adminEmail);
  console.info(`  ✅ Role set to admin for ${adminEmail}.`);
}

run()
  .catch((err: unknown) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

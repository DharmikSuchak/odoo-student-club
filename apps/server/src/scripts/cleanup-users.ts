import 'dotenv/config';

// Development only: removes duplicate / placeholder accounts.
// Safe to re-run; it is idempotent.

import { connectDb, closeDb, getDb } from '../db/connection.js';

const MONGO_URI =
  process.env['MONGO_URI'] ??
  'mongodb://localhost:27017/student_club?directConnection=true';

// Accounts to delete – these are the generic placeholder admins and the
// duplicate Dharmik Suchak member entry created during earlier test runs.
const EMAILS_TO_DELETE = [
  'admin@studentclub.test',   // generic placeholder admin
  'admin@club.example',       // second placeholder admin
  'dharmiksuchak7755@gmail.com', // duplicate Dharmik Suchak entry
];

async function run(): Promise<void> {
  await connectDb(MONGO_URI);
  const users = getDb().collection('users');

  for (const email of EMAILS_TO_DELETE) {
    const found = await users.findOne({ email: email.toLowerCase() });
    if (found === null) {
      console.info(`Skip: ${email} – not found.`);
      continue;
    }
    await users.deleteOne({ email: email.toLowerCase() });
    console.info(`Deleted: ${email}`);
  }

  const remaining = await users.find({}).toArray();
  console.info(`\nRemaining users (${String(remaining.length)}):`);
  for (const u of remaining) {
    console.info(`  ${String(u['role']).padEnd(12)} ${String(u['email'])}  (${String(u['displayName'])})`);
  }
}

run()
  .catch((err: unknown) => {
    console.error('Error: Cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

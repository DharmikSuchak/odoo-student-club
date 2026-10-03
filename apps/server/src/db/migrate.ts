/**
 * Idempotent migration script to create all required MongoDB collections and indexes.
 *
 * Rule (AGENTS.md §8): Index every field used in a filter or sort.
 * Indexes are created here, not ad-hoc in the application startup.
 */
import { connectDb, getDb, closeDb } from './connection.js';

async function migrate() {
  const uri = process.env['MONGO_URI'] || 'mongodb://localhost:27017/student_club?replicaSet=rs0';
  console.info(`Connecting to MongoDB at ${uri}...`);

  await connectDb(uri);
  const db = getDb();

  console.info('Creating collections and indexes...');

  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ role: 1 });

  const membershipTiers = db.collection('membershipTiers');
  await membershipTiers.createIndex({ clubId: 1, isActive: 1 });

  const memberships = db.collection('memberships');
  await memberships.createIndex({ userId: 1, status: 1 });
  await memberships.createIndex({ tierId: 1 });
  await memberships.createIndex({ clubId: 1 });
  await memberships.createIndex({ endDate: 1 }); // for expiry queries
  await memberships.createIndex({ clubId: 1, status: 1, endDate: 1 });

  const events = db.collection('events');
  await events.createIndex({ clubId: 1, startsAt: -1 });
  await events.createIndex({ isPublished: 1, startsAt: 1 });
  await events.createIndex({ clubId: 1, isPublished: 1, startsAt: 1 });

  const tasks = db.collection('tasks');
  await tasks.createIndex({ clubId: 1, status: 1 });

  const eventTickets = db.collection('eventTickets');
  await eventTickets.createIndex({ eventId: 1, status: 1 }); // for capacity count
  await eventTickets.createIndex({ userId: 1, eventId: 1 }, { unique: true }); // prevent double registration

  const payments = db.collection('payments');
  // Unique sparse index: only applies if providerEventId is non-null
  await payments.createIndex(
    { providerEventId: 1 },
    { unique: true, partialFilterExpression: { providerEventId: { $type: 'string' } } },
  );
  await payments.createIndex({ 'relatedEntity.id': 1 });
  await payments.createIndex({ status: 1, 'relatedEntity.type': 1, currency: 1 });

  const expenses = db.collection('expenses');
  await expenses.createIndex({ clubId: 1, status: 1, createdAt: -1 });
  await expenses.createIndex({ clubId: 1, submittedBy: 1, createdAt: -1 });

  const orders = db.collection('orders');
  await orders.createIndex({ userId: 1, status: 1 });

  const volunteerAssignments = db.collection('volunteerAssignments');
  await volunteerAssignments.createIndex({ taskId: 1, userId: 1 }, { unique: true });

  console.info('✅ Migrations completed successfully.');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

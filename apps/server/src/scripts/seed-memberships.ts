import 'dotenv/config';

// Development and staging only; review before running against production data.

import { ObjectId } from 'mongodb';

import { connectDb, closeDb, getDb } from '../db/connection.js';

const MONGO_URI =
  process.env['MONGO_URI'] ?? 'mongodb://localhost:27017/student_club?replicaSet=rs0';
const CLUB_ID = process.env['CLUB_ID'] ?? '000000000000000000000001';
const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@club.example';

if (!/^[0-9a-f]{24}$/i.test(CLUB_ID)) {
  console.error('Error: CLUB_ID must be a 24-character hex ObjectId.');
  process.exit(1);
}

async function run(): Promise<void> {
  await connectDb(MONGO_URI);
  const db = getDb();

  const clubs = db.collection('clubs');
  const existingClub = await clubs.findOne({ _id: new ObjectId(CLUB_ID) });
  if (existingClub === null) {
    await clubs.insertOne({
      _id: new ObjectId(CLUB_ID),
      name: 'Student Club',
      description: 'The main student club for the platform.',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.info('Done: Club document created.');
  } else {
    console.info('Skipped: Club document already exists — skipping.');
  }

  const tiers = db.collection('membershipTiers');
  const existingTier = await tiers.findOne({ clubId: CLUB_ID, name: 'General Member' });
  if (existingTier === null) {
    await tiers.insertOne({
      clubId: CLUB_ID,
      name: 'General Member',
      description: 'Standard annual membership with full club access.',
      durationDays: 365,
      priceCents: 50000,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.info('Done: "General Member" tier created.');
  } else {
    console.info('Skipped: "General Member" tier already exists — skipping.');
  }

  const users = db.collection('users');
  const admin = await users.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (admin !== null) {
    const tier = await tiers.findOne({ clubId: CLUB_ID, name: 'General Member' });
    if (tier !== null) {
      const memberships = db.collection('memberships');
      const existingMembership = await memberships.findOne({ userId: admin['_id'].toString() });
      if (existingMembership === null) {
        const startDate = new Date();
        // endDate: midnight UTC one year from today
        const endDate = new Date(
          Date.UTC(startDate.getUTCFullYear() + 1, startDate.getUTCMonth(), startDate.getUTCDate()),
        );
        await memberships.insertOne({
          userId: admin['_id'].toString(),
          tierId: tier['_id'].toString(),
          clubId: CLUB_ID,
          status: 'pending_payment',
          startDate,
          endDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.info(`Done: Sample membership created for ${ADMIN_EMAIL} (pending_payment).`);
        console.info(`    Use POST /api/memberships/<id>/record-payment to activate it.`);
      } else {
        console.info(`Skipped: ${ADMIN_EMAIL} already has a membership — skipping.`);
      }
    }
  } else {
    console.info(`Skipped: Admin user ${ADMIN_EMAIL} not found — run seed-admin.ts first.`);
  }
}

run()
  .catch((err: unknown) => {
    console.error('Error: Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

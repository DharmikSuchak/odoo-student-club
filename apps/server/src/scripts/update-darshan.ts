import 'dotenv/config';
import { connectDb, closeDb, getDb } from '../db/connection.js';

const MONGO_URI = process.env['MONGO_URI'] ?? 'mongodb://127.0.0.1:27017/student_club?directConnection=true';

async function run(): Promise<void> {
  await connectDb(MONGO_URI);
  const db = getDb();

  const users = db.collection('users');
  const user = await users.findOne({ displayName: 'Darshan sodha' });

  if (!user) {
    console.error('User Darshan sodha not found.');
    return;
  }

  const memberships = db.collection('memberships');
  const result = await memberships.updateOne(
    { userId: user._id.toString() },
    { 
      $set: { status: 'pending_payment' },
      $unset: { amountPaidCents: '', paidAt: '' }
    }
  );

  console.log(`Updated membership for Darshan sodha: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
}

run()
  .catch(console.error)
  .finally(closeDb);

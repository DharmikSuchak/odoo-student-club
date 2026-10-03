import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

async function run() {
  const client = new MongoClient('mongodb://localhost:27017/student_club?replicaSet=rs0');
  await client.connect();
  const db = client.db('student_club');
  const passwordHash = await bcrypt.hash('Password123!', 12);
  
  // ensure unique
  await db.collection('users').deleteOne({ email: 'officer@test.com' });
  
  await db.collection('users').insertOne({
    email: 'officer@test.com',
    passwordHash,
    displayName: 'Smoke Test Officer',
    role: 'officer',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('Officer created');
  process.exit(0);
}
run().catch(console.error);

import 'dotenv/config';

import { connectDb, closeDb, getDb } from '../db/connection.js';

const MONGO_URI =
  process.env['MONGO_URI'] ?? 'mongodb://localhost:27017/student_club?replicaSet=rs0';
const CLUB_ID = process.env['CLUB_ID'] ?? '000000000000000000000001';

async function run(): Promise<void> {
  await connectDb(MONGO_URI);
  const db = getDb();

  const tasks = db.collection('tasks');
  const users = db.collection('users');

  // Clear existing tasks
  await tasks.deleteMany({ clubId: CLUB_ID });
  
  const allUsers = await users.find({}).toArray();
  if (allUsers.length === 0) {
    console.error('No users found. Run seed-admin.ts first.');
    process.exit(1);
  }

  const officer = allUsers.find(u => u['role'] === 'officer' || u['role'] === 'admin') ?? allUsers[0];
  if (!officer) {
    console.error('No officer or admin user found.');
    process.exit(1);
  }

  // Assignees – fall back to officer when there are fewer than 3 users.
  const assignee1 = allUsers[0] ?? officer;
  const assignee2 = allUsers[1] ?? officer;
  const assignee3 = allUsers[2] ?? officer;
  
  const seedTasks = [
    {
      clubId: CLUB_ID,
      createdBy: officer._id.toString(),
      title: 'Bake goods for the sale',
      description: 'Bake 3 dozen cookies and 2 dozen brownies for the table.',
      status: 'done',
      assigneeId: assignee1._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      clubId: CLUB_ID,
      createdBy: officer._id.toString(),
      title: 'Buy baking supplies',
      description: 'Get flour, sugar, butter, and napkins from the store.',
      status: 'done',
      assigneeId: assignee2._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      clubId: CLUB_ID,
      createdBy: officer._id.toString(),
      title: 'Manage the table on the day',
      description: 'Set up the table, handle cash, and sell the goods.',
      status: 'in_progress',
      assigneeId: assignee3._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      clubId: CLUB_ID,
      createdBy: officer._id.toString(),
      title: 'Promote the bake sale',
      description: 'Make flyers and post on social media to spread the word.',
      status: 'not_started',
      assigneeId: assignee1._id.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

  await tasks.insertMany(seedTasks);
  console.info('Done: Volunteer tasks seeded.');
}

run()
  .catch((err: unknown) => {
    console.error('Error: Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

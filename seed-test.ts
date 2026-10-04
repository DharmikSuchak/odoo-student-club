import 'dotenv/config';
import { connectDb, closeDb } from './apps/server/src/db/connection.js';
import { seedUser } from './apps/server/src/db/seed.js';

async function run() {
  await connectDb(process.env.MONGO_URI!);
  await seedUser('Dharmik@gmail.com', 'Dharmik@12345', 'DS Club Admin', 'admin');
  console.log("Seeded user");
  await closeDb();
}
run();

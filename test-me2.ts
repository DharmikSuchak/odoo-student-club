import 'dotenv/config';
import { signJwt } from './apps/server/src/middleware/auth.js';
import { connectDb, closeDb, getDb } from './apps/server/src/db/connection.js';

async function run() {
  await connectDb(process.env.MONGO_URI!);
  const db = getDb();
  const user = await db.collection('users').findOne({ email: 'admin@club.example' });
  if (!user) throw new Error("User not found");

  const token = signJwt({
    userId: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role
  });
  console.log("Cookie: access_token=" + token);
  await closeDb();
}
run();

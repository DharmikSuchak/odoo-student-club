import 'dotenv/config';
import { signJwt } from './apps/server/src/middleware/auth.js';
import { env } from './apps/server/src/config/env.js';

const token = signJwt({
  userId: '000000000000000000000001',
  email: 'admin@club.example',
  displayName: 'Admin',
  role: 'admin'
});
console.log(token);

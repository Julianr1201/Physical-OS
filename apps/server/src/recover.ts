import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { AppDatabase } from './db/database.js';
import { hashPassword } from './auth.js';

const dataDir = process.env.PHYSICAL_OS_DATA_DIR ?? resolve(process.cwd(), 'data');
const database = new AppDatabase(resolve(dataDir, 'physical-os.sqlite'));
const users = await database.listUsers();
const admin = users.find((user) => user.role === 'admin') ?? users[0];
if (!admin) {
  console.log('No administrator exists yet. Open the console and complete first-run setup.');
  await database.close();
  process.exit(0);
}
const password = randomBytes(18).toString('base64url');
const hashed = await hashPassword(password);
await database.updatePassword(admin.id, hashed.hash, hashed.salt);
await database.deleteSessions();
await database.close();
console.log('Administrator sessions were revoked.');
console.log('Temporary password (shown once):');
console.log(password);
console.log('Log in and replace it by running recovery again after you store a password of your own.');

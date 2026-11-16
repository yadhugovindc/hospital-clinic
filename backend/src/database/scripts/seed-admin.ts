import 'dotenv/config';
import bcrypt from 'bcrypt';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import { User } from '../models/user.model.js';
import { seedSettings } from '../seeds/seed-settings.js';
import { env } from '../../config/env.js';

/**
 * Creates the first Admin account and the clinic settings document.
 * Idempotent: if an admin already exists, prints a notice and exits.
 * Credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env
 * (never hardcoded, never committed).
 */
async function main(): Promise<void> {
  await connectDatabase();
  await seedSettings();

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(`An admin already exists: ${existingAdmin.email}. Nothing to do.`);
    await disconnectDatabase();
    return;
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? env.SEED_ADMIN_EMAIL)?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing admin credentials. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env, then re-run: npm run seed:admin',
    );
    await disconnectDatabase();
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    await disconnectDatabase();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  await User.create({
    email: String(email),
    name: 'System Administrator',
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  console.log(`Admin created: ${email}`);
  console.log('Change this password after first login.');
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

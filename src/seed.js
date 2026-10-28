'use strict';

// Creates (or updates) the first Admin account from env credentials.
// Run with: npm run seed
require('dotenv').config();

const { Users } = require('./db');
const { hashPassword } = require('./auth');

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

  if (password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const password_hash = await hashPassword(password);
  const existing = Users.findByUsername(username);

  if (existing) {
    Users.update(username, { password_hash, role: 'Admin' });
    console.log(`Updated existing user "${username}" and ensured role Admin.`);
  } else {
    Users.create({ username, password_hash, role: 'Admin' });
    console.log(`Created Admin user "${username}".`);
  }

  console.log('Seed complete. Log in with the credentials from your .env file.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

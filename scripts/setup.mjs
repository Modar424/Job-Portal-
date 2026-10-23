// One-time setup: creates .env, the MySQL database, the tables and demo data.
// Usage: npm install && npm run setup
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');

if (!fs.existsSync(envFile)) {
  const text = fs
    .readFileSync(path.join(root, '.env.example'), 'utf8')
    .replace('change_me_to_a_long_random_string', crypto.randomBytes(48).toString('hex'));
  fs.writeFileSync(envFile, text);
  console.log('Created .env');
}
dotenv.config({ path: envFile });

const { DB_HOST = 'localhost', DB_PORT = '3306', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'jobportal' } = process.env;
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  console.error('DB_NAME may only contain letters, digits and underscores');
  process.exit(1);
}

try {
  const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  console.log(`Database "${DB_NAME}" is ready`);
} catch (e) {
  console.error(`\nCould not connect to MySQL at ${DB_HOST}:${DB_PORT} as "${DB_USER}": ${e.code || e.message}`);
  console.error('1) Make sure MySQL is running.  2) Put your MySQL user/password in the .env file (DB_USER, DB_PASSWORD) and run "npm run setup" again.');
  process.exit(1);
}

const run = (args) => {
  const r = spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['run', 'migrate', '-w', 'backend']);
run(['run', 'seed', '-w', 'backend']);

console.log('\nSetup finished. Start everything with:  npm run dev');
console.log('Open http://localhost:5173  |  admin@jobportal.test / employer1@jobportal.test / seeker1@jobportal.test  (password: Demo1234!)');

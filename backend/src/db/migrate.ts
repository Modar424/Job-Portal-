import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const dir = fileURLToPath(new URL('../../migrations', import.meta.url));

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
  });
  await conn.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  );
  const [done] = await conn.query('SELECT name FROM schema_migrations');
  const applied = new Set((done as { name: string }[]).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    console.log(`Applying ${f}`);
    await conn.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
  }
  console.log('Migrations up to date');
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

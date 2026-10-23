import mysql, { type PoolConnection, type ResultSetHeader } from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Runner = Pick<PoolConnection, 'query'> | typeof pool;

// Force UTC on every connection so TIMESTAMP/DATETIME comparisons (expiry, token lifetimes) are consistent.
(pool as unknown as { pool: { on: (e: string, f: (c: { query: (s: string) => void }) => void) => void } }).pool.on(
  'connection',
  (c) => c.query("SET time_zone = '+00:00'"),
);

export async function rows<T = Row>(sql: string, params: unknown[] = [], r: Runner = pool): Promise<T[]> {
  const [res] = await r.query(sql, params);
  return res as T[];
}

export async function one<T = Row>(sql: string, params: unknown[] = [], r: Runner = pool): Promise<T | undefined> {
  return (await rows<T>(sql, params, r))[0];
}

export async function exec(sql: string, params: unknown[] = [], r: Runner = pool): Promise<ResultSetHeader> {
  const [res] = await r.query(sql, params);
  return res as ResultSetHeader;
}

export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

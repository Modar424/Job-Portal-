import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
// Used to keep login timing similar when the account does not exist.
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const signToken = (userId: number) =>
  jwt.sign({ sub: String(userId) }, env.SESSION_SECRET, { expiresIn: '7d', algorithm: 'HS256' });

export function readToken(token: string): { id: number; iat: number } | null {
  try {
    const p = jwt.verify(token, env.SESSION_SECRET, { algorithms: ['HS256'] });
    if (typeof p !== 'object') return null;
    const id = Number(p.sub);
    return Number.isInteger(id) && id > 0 ? { id, iat: p.iat ?? 0 } : null;
  } catch {
    return null;
  }
}

/** One-time tokens are random; only their SHA-256 hash is stored. */
export const newToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

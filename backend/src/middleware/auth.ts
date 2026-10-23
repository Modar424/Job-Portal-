import type { NextFunction, Request, Response } from 'express';
import { one } from '../db/pool.js';
import { readToken } from '../utils/security.js';
import { HttpError } from './errors.js';

export type Role = 'seeker' | 'employer' | 'admin';
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  emailVerified: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    id?: string;
  }
}

export const COOKIE = 'jp_token';

async function load(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[COOKIE];
  if (!token || typeof token !== 'string') return null;
  const t = readToken(token);
  if (!t) return null;
  const u = await one<{
    id: number; email: string; full_name: string; role: Role; status: string;
    email_verified_at: Date | null; password_changed_at: Date | null;
  }>('SELECT id, email, full_name, role, status, email_verified_at, password_changed_at FROM users WHERE id = ?', [t.id]);
  if (!u || u.status !== 'active') return null;
  // Tokens issued before the last password change are no longer valid.
  if (u.password_changed_at && t.iat < Math.floor(new Date(u.password_changed_at).getTime() / 1000)) return null;
  return { id: u.id, email: u.email, fullName: u.full_name, role: u.role, emailVerified: !!u.email_verified_at };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await load(req);
    if (!user) throw new HttpError(401, 'Authentication required');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await load(req);
    if (user) req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'));
    next();
  };

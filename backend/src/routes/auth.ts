import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isProd } from '../config/env.js';
import { exec, one, rows, tx } from '../db/pool.js';
import { COOKIE, authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { removeUpload } from '../middleware/upload.js';
import { audit } from '../modules/audit.js';
import { sendMail } from '../modules/mailer.js';
import { changePasswordSchema, emailSchema, loginSchema, registerSchema, resetSchema } from '../modules/schemas.js';
import { ok, wrap } from '../utils/http.js';
import { DUMMY_HASH, hashPassword, hashToken, newToken, signToken, verifyPassword } from '../utils/security.js';
import { z } from 'zod';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts, try again later' } },
});

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: isProd, path: '/' };
const setCookie = (res: Response, userId: number) =>
  res.cookie(COOKIE, signToken(userId), { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });

const LOCK_THRESHOLD = 5;

type UserRow = { id: number; email: string; full_name: string; role: string; email_verified_at?: Date | null };
const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  role: u.role,
  emailVerified: !!u.email_verified_at,
});

async function issueToken(userId: number, type: 'password_reset' | 'email_verify', hours: number) {
  await exec('UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND type = ? AND used_at IS NULL', [userId, type]);
  const token = newToken();
  await exec(
    'INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))',
    [userId, type, hashToken(token), hours],
  );
  return token;
}

async function sendVerification(userId: number, email: string, name: string) {
  const token = await issueToken(userId, 'email_verify', 48);
  sendMail(email, 'Verify your HireNest email', `Hi ${name},\n\nConfirm your email address:\n${env.CLIENT_ORIGIN}/verify-email?token=${token}\n\nThis link expires in 48 hours.`);
}

authRouter.post(
  '/register',
  limiter,
  wrap(async (req, res) => {
    const b = registerSchema.parse(req.body);
    if (b.role === 'employer' && !b.companyName) {
      throw new HttpError(400, 'Validation failed', { companyName: ['Company name is required'] });
    }
    if (await one('SELECT id FROM users WHERE email = ?', [b.email])) {
      throw new HttpError(409, 'Email is already registered');
    }
    const hash = await hashPassword(b.password);
    const id = await tx(async (c) => {
      const r = await exec(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [b.email, hash, b.fullName, b.role],
        c,
      );
      if (b.role === 'seeker') await exec('INSERT INTO seeker_profiles (user_id) VALUES (?)', [r.insertId], c);
      else await exec('INSERT INTO companies (owner_id, name) VALUES (?, ?)', [r.insertId, b.companyName], c);
      return r.insertId;
    });
    await sendVerification(id, b.email, b.fullName);
    await audit(req, id, 'auth.register', 'user', id, { role: b.role });
    setCookie(res, id);
    ok(res, { id, email: b.email, fullName: b.fullName, role: b.role, emailVerified: false }, undefined, 201);
  }),
);

authRouter.post(
  '/login',
  limiter,
  wrap(async (req, res) => {
    const b = loginSchema.parse(req.body);
    const u = await one<UserRow & { status: string; password_hash: string; locked_until: Date | null }>(
      'SELECT id, email, full_name, role, status, password_hash, locked_until, email_verified_at FROM users WHERE email = ?',
      [b.email],
    );
    if (u?.locked_until && new Date(u.locked_until) > new Date()) {
      throw new HttpError(429, 'Account temporarily locked after repeated failed logins. Try again in 15 minutes or reset your password.');
    }
    const valid = await verifyPassword(b.password, u?.password_hash ?? DUMMY_HASH);
    if (!u || !valid) {
      if (u) {
        await exec(
          `UPDATE users SET failed_logins = failed_logins + 1,
           locked_until = IF(failed_logins >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), locked_until) WHERE id = ?`,
          [LOCK_THRESHOLD, u.id],
        );
        await audit(req, u.id, 'auth.login_failed', 'user', u.id);
      }
      throw new HttpError(401, 'Invalid email or password');
    }
    if ((u as { status: string }).status !== 'active') throw new HttpError(403, 'This account has been suspended');
    await exec('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [u.id]);
    await audit(req, u.id, 'auth.login', 'user', u.id);
    setCookie(res, u.id);
    ok(res, publicUser(u));
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, cookieOpts);
  ok(res, { loggedOut: true });
});

authRouter.get('/me', authenticate, (req, res) => ok(res, req.user));

// ---- password reset (response is identical whether or not the email exists)
authRouter.post(
  '/forgot-password',
  limiter,
  wrap(async (req, res) => {
    const { email } = emailSchema.parse(req.body);
    const u = await one<{ id: number; full_name: string; status: string }>('SELECT id, full_name, status FROM users WHERE email = ?', [email]);
    if (u && u.status === 'active') {
      const token = await issueToken(u.id, 'password_reset', 1);
      sendMail(email, 'Reset your HireNest password', `Hi ${u.full_name},\n\nReset your password using this link (valid for 1 hour):\n${env.CLIENT_ORIGIN}/reset-password?token=${token}\n\nIf you did not request this, you can ignore this email.`);
      await audit(req, u.id, 'auth.password_reset_requested', 'user', u.id);
    }
    ok(res, { message: 'If that email is registered, a reset link has been sent.' });
  }),
);

authRouter.post(
  '/reset-password',
  limiter,
  wrap(async (req, res) => {
    const b = resetSchema.parse(req.body);
    const t = await one<{ id: number; user_id: number }>(
      "SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND type = 'password_reset' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
      [hashToken(b.token)],
    );
    if (!t) throw new HttpError(400, 'This reset link is invalid or has expired');
    const hash = await hashPassword(b.password);
    await tx(async (c) => {
      await exec('UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP(), failed_logins = 0, locked_until = NULL WHERE id = ?', [hash, t.user_id], c);
      await exec('UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [t.id], c);
    });
    await audit(req, t.user_id, 'auth.password_reset', 'user', t.user_id);
    ok(res, { reset: true });
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  limiter,
  wrap(async (req, res) => {
    const b = changePasswordSchema.parse(req.body);
    const u = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!u || !(await verifyPassword(b.currentPassword, u.password_hash))) {
      throw new HttpError(400, 'Validation failed', { currentPassword: ['Current password is incorrect'] });
    }
    await exec('UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [await hashPassword(b.newPassword), req.user!.id]);
    await audit(req, req.user!.id, 'auth.password_changed', 'user', req.user!.id);
    // Other sessions are invalidated (see authenticate); keep this one alive with a fresh token.
    setCookie(res, req.user!.id);
    ok(res, { changed: true });
  }),
);

// ---- email verification
authRouter.post(
  '/verify-email',
  limiter,
  wrap(async (req, res) => {
    const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
    const t = await one<{ id: number; user_id: number }>(
      "SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND type = 'email_verify' AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
      [hashToken(token)],
    );
    if (!t) throw new HttpError(400, 'This verification link is invalid or has expired');
    await tx(async (c) => {
      await exec('UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ? AND email_verified_at IS NULL', [t.user_id], c);
      await exec('UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [t.id], c);
    });
    ok(res, { verified: true });
  }),
);

authRouter.post(
  '/resend-verification',
  authenticate,
  limiter,
  wrap(async (req, res) => {
    if (req.user!.emailVerified) throw new HttpError(409, 'Email is already verified');
    await sendVerification(req.user!.id, req.user!.email, req.user!.fullName);
    ok(res, { sent: true });
  }),
);

// ---- account deletion (self-service; administrators cannot delete themselves here)
authRouter.delete(
  '/account',
  authenticate,
  limiter,
  wrap(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1).max(72) }).parse(req.body);
    if (req.user!.role === 'admin') throw new HttpError(403, 'Administrator accounts cannot be deleted here');
    const u = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      throw new HttpError(400, 'Validation failed', { password: ['Password is incorrect'] });
    }
    const files = [
      ...(await rows<{ f: string | null }>('SELECT resume_file AS f FROM seeker_profiles WHERE user_id = ?', [req.user!.id])),
      ...(await rows<{ f: string | null }>('SELECT resume_file AS f FROM applications WHERE seeker_id = ?', [req.user!.id])),
    ];
    await audit(req, null, 'account.deleted', 'user', req.user!.id, { role: req.user!.role });
    await exec('DELETE FROM users WHERE id = ?', [req.user!.id]);
    files.forEach((x) => removeUpload(x.f));
    res.clearCookie(COOKIE, cookieOpts);
    ok(res, { deleted: true });
  }),
);

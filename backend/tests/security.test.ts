import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const users = new Map<number, { id: number; email: string; full_name: string; role: string; status: string; email_verified_at?: Date | null; password_changed_at?: Date | null }>();

vi.mock('../src/db/pool.js', () => ({
  pool: { query: vi.fn(), getConnection: vi.fn() },
  pingDb: vi.fn(async () => false),
  rows: vi.fn(async () => []),
  exec: vi.fn(async () => ({ insertId: 1, affectedRows: 1 })),
  tx: vi.fn(),
  one: vi.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM users WHERE id')) return users.get(params[0] as number);
    return undefined;
  }),
}));

import { createApp } from '../src/app.js';
import { COOKIE } from '../src/middleware/auth.js';
import { signToken } from '../src/utils/security.js';

const app = createApp();
const cookie = (id: number) => `${COOKIE}=${signToken(id)}`;

beforeEach(() => {
  users.clear();
  users.set(1, { id: 1, email: 's@x.co', full_name: 'Seeker', role: 'seeker', status: 'active' });
  users.set(2, { id: 2, email: 'e@x.co', full_name: 'Emp', role: 'employer', status: 'active' });
  users.set(3, { id: 3, email: 'a@x.co', full_name: 'Admin', role: 'admin', status: 'active' });
  users.set(5, { id: 5, email: 'p@x.co', full_name: 'Pw', role: 'seeker', status: 'active', password_changed_at: new Date(Date.now() + 60_000) });
  users.set(4, { id: 4, email: 'z@x.co', full_name: 'Susp', role: 'admin', status: 'suspended' });
});

describe('authentication', () => {
  it.each(['/api/auth/me', '/api/seeker/profile', '/api/employer/jobs', '/api/admin/stats', '/api/notifications'])(
    '%s rejects anonymous requests',
    async (path) => {
      expect((await request(app).get(path)).status).toBe(401);
    },
  );

  it('rejects a forged/invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', `${COOKIE}=not.a.jwt`);
    expect(res.status).toBe(401);
  });

  it('rejects tokens of suspended users', async () => {
    expect((await request(app).get('/api/admin/stats').set('Cookie', cookie(4))).status).toBe(401);
  });

  it('login validates input before touching the database', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nope' });
    expect(res.status).toBe(400);
  });

  it('register rejects weak passwords and admin role', async () => {
    const weak = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: '123', fullName: 'Al', role: 'seeker' });
    expect(weak.status).toBe(400);
    const admin = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'goodpass1', fullName: 'Al', role: 'admin' });
    expect(admin.status).toBe(400);
  });
});

describe('role-based access', () => {
  it('seeker cannot reach employer or admin endpoints', async () => {
    expect((await request(app).get('/api/employer/jobs').set('Cookie', cookie(1))).status).toBe(403);
    expect((await request(app).get('/api/admin/users').set('Cookie', cookie(1))).status).toBe(403);
  });
  it('employer cannot reach seeker or admin endpoints', async () => {
    expect((await request(app).get('/api/seeker/applications').set('Cookie', cookie(2))).status).toBe(403);
    expect((await request(app).patch('/api/admin/users/1').set('Cookie', cookie(2)).send({ status: 'suspended' })).status).toBe(403);
  });
  it('admin cannot use seeker/employer-only actions', async () => {
    expect((await request(app).post('/api/employer/jobs').set('Cookie', cookie(3)).send({})).status).toBe(403);
  });
  it('admin cannot modify own account', async () => {
    const res = await request(app).patch('/api/admin/users/3').set('Cookie', cookie(3)).send({ status: 'suspended' });
    expect(res.status).toBe(400);
  });
});

describe('account security', () => {
  it('invalidates tokens issued before the last password change', async () => {
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie(5))).status).toBe(401);
  });
  it('forgot/reset/verify validate input', async () => {
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'short', password: 'goodpass1' })).status).toBe(400);
    expect((await request(app).post('/api/auth/verify-email').send({ token: 'x' })).status).toBe(400);
  });
  it('forgot-password never reveals whether an email exists', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@x.co' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/if that email/i);
  });
  it('change-password requires auth and a strong new password', async () => {
    expect((await request(app).post('/api/auth/change-password').send({})).status).toBe(401);
    const weak = await request(app).post('/api/auth/change-password').set('Cookie', cookie(1)).send({ currentPassword: 'x', newPassword: '123' });
    expect(weak.status).toBe(400);
  });
  it('administrators cannot self-delete through the account endpoint', async () => {
    expect((await request(app).delete('/api/auth/account').set('Cookie', cookie(3)).send({ password: 'x' })).status).toBe(403);
  });
});

describe('moderation and exports', () => {
  it('only seekers can report jobs', async () => {
    expect((await request(app).post('/api/jobs/1/report').send({ reason: 'spam' })).status).toBe(401);
    expect((await request(app).post('/api/jobs/1/report').set('Cookie', cookie(2)).send({ reason: 'spam' })).status).toBe(403);
    expect((await request(app).post('/api/jobs/1/report').set('Cookie', cookie(1)).send({ reason: 'bogus' })).status).toBe(400);
  });
  it('CSV export and rating are employer-only', async () => {
    expect((await request(app).get('/api/employer/applications-export.csv')).status).toBe(401);
    expect((await request(app).get('/api/employer/applications-export.csv').set('Cookie', cookie(1))).status).toBe(403);
    expect((await request(app).put('/api/employer/applications/1/rating').set('Cookie', cookie(1)).send({ rating: 5 })).status).toBe(403);
  });
  it('audit log and reports are admin-only', async () => {
    for (const p of ['/api/admin/audit', '/api/admin/reports', '/api/admin/analytics']) {
      expect((await request(app).get(p).set('Cookie', cookie(2))).status).toBe(403);
    }
  });
  it('employer rating validates range', async () => {
    expect((await request(app).put('/api/employer/applications/1/rating').set('Cookie', cookie(2)).send({ rating: 9 })).status).toBe(400);
  });
});

describe('input hardening', () => {
  it('rejects invalid job filters with 400', async () => {
    expect((await request(app).get('/api/jobs?type=bogus')).status).toBe(400);
    expect((await request(app).get('/api/jobs?page=0')).status).toBe(400);
    expect((await request(app).get('/api/jobs?pageSize=1000')).status).toBe(400);
  });
  it('rejects non-numeric ids', async () => {
    expect((await request(app).get('/api/jobs/abc')).status).toBe(400);
  });
  it('returns JSON 404 for unknown routes and sets security headers', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('rejects malformed JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
  it('file download requires authentication', async () => {
    expect((await request(app).get('/api/files/applications/1/resume')).status).toBe(401);
  });
});

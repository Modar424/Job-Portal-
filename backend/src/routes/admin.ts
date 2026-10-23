import { Router } from 'express';
import { z } from 'zod';
import { exec, one, rows } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit } from '../modules/audit.js';
import { notify } from '../modules/notify.js';
import { paging } from '../modules/schemas.js';
import { escapeLike, ok, pageMeta, parseId, wrap } from '../utils/http.js';
import { fillDays } from '../utils/series.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

const count = async (sql: string, p: unknown[] = []) => (await one<{ n: number }>(sql, p))?.n ?? 0;

adminRouter.get(
  '/stats',
  wrap(async (_req, res) => {
    const byRole = await rows<{ role: string; n: number }>('SELECT role, COUNT(*) AS n FROM users GROUP BY role');
    const byStatus = await rows<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM applications GROUP BY status');
    ok(res, {
      users: Object.fromEntries(byRole.map((r) => [r.role, r.n])),
      suspendedUsers: await count("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
      unverifiedUsers: await count('SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NULL'),
      jobs: await count('SELECT COUNT(*) AS n FROM jobs'),
      activeJobs: await count("SELECT COUNT(*) AS n FROM jobs WHERE status = 'active' AND moderation = 'approved'"),
      removedJobs: await count("SELECT COUNT(*) AS n FROM jobs WHERE moderation = 'removed'"),
      companies: await count('SELECT COUNT(*) AS n FROM companies'),
      openReports: await count("SELECT COUNT(*) AS n FROM job_reports WHERE status = 'open'"),
      applications: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    });
  }),
);

adminRouter.get(
  '/analytics',
  wrap(async (_req, res) => {
    const series = (table: string) =>
      rows<{ d: string; n: number }>(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS n FROM ${table}
         WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) GROUP BY d`,
      );
    const topCategories = await rows(
      `SELECT cat.name, COUNT(*) AS jobs FROM jobs j JOIN categories cat ON cat.id = j.category_id
       WHERE j.status = 'active' AND j.moderation = 'approved' GROUP BY cat.id, cat.name ORDER BY jobs DESC LIMIT 6`,
    );
    ok(res, {
      signups: fillDays(await series('users'), 30),
      applications: fillDays(await series('applications'), 30),
      jobsPosted: fillDays(await series('jobs'), 30),
      topCategories,
    });
  }),
);

adminRouter.get(
  '/users',
  wrap(async (req, res) => {
    const f = z
      .object({
        q: z.string().trim().max(100).optional(),
        role: z.enum(['seeker', 'employer', 'admin']).optional(),
        status: z.enum(['active', 'suspended']).optional(),
        ...paging,
      })
      .parse(req.query);
    const w: string[] = ['1=1'];
    const p: unknown[] = [];
    if (f.q) {
      w.push('(email LIKE ? OR full_name LIKE ?)');
      const l = `%${escapeLike(f.q)}%`;
      p.push(l, l);
    }
    if (f.role) (w.push('role = ?'), p.push(f.role));
    if (f.status) (w.push('status = ?'), p.push(f.status));
    const total = await count(`SELECT COUNT(*) AS n FROM users WHERE ${w.join(' AND ')}`, p);
    const data = await rows(
      `SELECT id, email, full_name AS fullName, role, status, created_at AS createdAt, last_login_at AS lastLoginAt,
        (email_verified_at IS NOT NULL) AS emailVerified, (locked_until IS NOT NULL AND locked_until > UTC_TIMESTAMP()) AS locked
       FROM users WHERE ${w.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...p, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data.map((u) => ({ ...u, emailVerified: !!u.emailVerified, locked: !!u.locked })), pageMeta(f.page, f.pageSize, total));
  }),
);

adminRouter.patch(
  '/users/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const b = z
      .object({ role: z.enum(['seeker', 'employer', 'admin']).optional(), status: z.enum(['active', 'suspended']).optional() })
      .refine((v) => v.role || v.status, 'Nothing to update')
      .parse(req.body);
    if (id === req.user!.id) throw new HttpError(400, 'You cannot change your own role or status');
    const u = await one<{ id: number; role: string }>('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!u) throw new HttpError(404, 'User not found');
    if (b.role && b.role !== u.role && b.role === 'employer') {
      throw new HttpError(400, 'Role change to employer requires a company profile; ask the user to register as an employer');
    }
    if (b.role) await exec('UPDATE users SET role = ? WHERE id = ?', [b.role, id]);
    if (b.status) {
      await exec('UPDATE users SET status = ?, failed_logins = IF(? = ?, 0, failed_logins), locked_until = IF(? = ?, NULL, locked_until) WHERE id = ?',
        [b.status, b.status, 'active', b.status, 'active', id]);
    }
    await audit(req, req.user!.id, 'admin.user_updated', 'user', id, b);
    ok(res, await one('SELECT id, email, full_name AS fullName, role, status FROM users WHERE id = ?', [id]));
  }),
);

adminRouter.get(
  '/jobs',
  wrap(async (req, res) => {
    const f = z
      .object({
        q: z.string().trim().max(100).optional(),
        moderation: z.enum(['approved', 'removed']).optional(),
        status: z.enum(['draft', 'active', 'closed']).optional(),
        ...paging,
      })
      .parse(req.query);
    const w: string[] = ['1=1'];
    const p: unknown[] = [];
    if (f.q) {
      w.push('(j.title LIKE ? OR c.name LIKE ?)');
      const l = `%${escapeLike(f.q)}%`;
      p.push(l, l);
    }
    if (f.moderation) (w.push('j.moderation = ?'), p.push(f.moderation));
    if (f.status) (w.push('j.status = ?'), p.push(f.status));
    const from = `FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${w.join(' AND ')}`;
    const total = await count(`SELECT COUNT(*) AS n ${from}`, p);
    const data = await rows(
      `SELECT j.id, j.title, j.status, j.moderation, j.featured, j.views, j.created_at AS createdAt, c.name AS companyName,
        (SELECT COUNT(*) FROM job_reports r WHERE r.job_id = j.id AND r.status = 'open') AS openReports ${from}
       ORDER BY j.id DESC LIMIT ? OFFSET ?`,
      [...p, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data.map((j) => ({ ...j, featured: !!j.featured })), pageMeta(f.page, f.pageSize, total));
  }),
);

adminRouter.patch(
  '/jobs/:id/moderation',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { moderation } = z.object({ moderation: z.enum(['approved', 'removed']) }).parse(req.body);
    const j = await one<{ title: string; owner_id: number }>('SELECT j.title, c.owner_id FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?', [id]);
    if (!j) throw new HttpError(404, 'Job not found');
    await exec('UPDATE jobs SET moderation = ? WHERE id = ?', [moderation, id]);
    await audit(req, req.user!.id, `admin.job_${moderation}`, 'job', id);
    await notify(j.owner_id, moderation === 'removed' ? `Your listing "${j.title}" was removed by moderation` : `Your listing "${j.title}" was restored`, '/employer?tab=jobs');
    ok(res, { id, moderation });
  }),
);

adminRouter.patch(
  '/jobs/:id/feature',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { featured } = z.object({ featured: z.boolean() }).parse(req.body);
    if (!(await one('SELECT id FROM jobs WHERE id = ?', [id]))) throw new HttpError(404, 'Job not found');
    await exec('UPDATE jobs SET featured = ? WHERE id = ?', [featured ? 1 : 0, id]);
    await audit(req, req.user!.id, featured ? 'admin.job_featured' : 'admin.job_unfeatured', 'job', id);
    ok(res, { id, featured });
  }),
);

adminRouter.get(
  '/reports',
  wrap(async (req, res) => {
    const f = z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open'), ...paging }).parse(req.query);
    const total = await count('SELECT COUNT(*) AS n FROM job_reports WHERE status = ?', [f.status]);
    const data = await rows(
      `SELECT r.id, r.reason, r.details, r.status, r.created_at AS createdAt, j.id AS jobId, j.title AS jobTitle, j.moderation,
        c.name AS companyName, u.full_name AS reporterName
       FROM job_reports r JOIN jobs j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id JOIN users u ON u.id = r.reporter_id
       WHERE r.status = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [f.status, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data, pageMeta(f.page, f.pageSize, total));
  }),
);

adminRouter.patch(
  '/reports/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const b = z.object({ status: z.enum(['resolved', 'dismissed']), removeJob: z.boolean().optional() }).parse(req.body);
    const r = await one<{ job_id: number; title: string; owner_id: number }>(
      `SELECT r.job_id, j.title, c.owner_id FROM job_reports r JOIN jobs j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id WHERE r.id = ?`, [id]);
    if (!r) throw new HttpError(404, 'Report not found');
    await exec('UPDATE job_reports SET status = ?, resolved_by = ?, resolved_at = UTC_TIMESTAMP() WHERE id = ?', [b.status, req.user!.id, id]);
    if (b.removeJob) {
      await exec("UPDATE jobs SET moderation = 'removed' WHERE id = ?", [r.job_id]);
      await notify(r.owner_id, `Your listing "${r.title}" was removed after a report`, '/employer?tab=jobs');
    }
    await audit(req, req.user!.id, `admin.report_${b.status}`, 'report', id, { removeJob: !!b.removeJob });
    ok(res, { id, status: b.status });
  }),
);

adminRouter.get(
  '/audit',
  wrap(async (req, res) => {
    const f = z.object({ action: z.string().trim().max(60).optional(), ...paging }).parse(req.query);
    const w = f.action ? 'WHERE a.action LIKE ?' : '';
    const p = f.action ? [`${escapeLike(f.action)}%`] : [];
    const total = await count(`SELECT COUNT(*) AS n FROM audit_logs a ${w}`, p);
    const data = await rows(
      `SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.meta, a.ip, a.created_at AS createdAt,
        u.email AS actorEmail FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${w}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [...p, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data, pageMeta(f.page, f.pageSize, total));
  }),
);

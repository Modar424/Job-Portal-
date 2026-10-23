import { Router } from 'express';
import { z } from 'zod';
import { exec, one, rows, tx } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit } from '../modules/audit.js';
import { sendMail } from '../modules/mailer.js';
import { notify } from '../modules/notify.js';
import { companySchema, jobSchema, paging } from '../modules/schemas.js';
import { setJobSkills } from '../modules/skills.js';
import { EMPLOYER_APP_TRANSITIONS, JOB_STATUSES, JOB_TRANSITIONS, canTransition } from '../utils/domain.js';
import { ok, pageMeta, parseId, wrap } from '../utils/http.js';
import { csvCell, fillDays } from '../utils/series.js';

export const employerRouter = Router();
employerRouter.use(authenticate, requireRole('employer'));

async function companyOf(uid: number) {
  const c = await one<{ id: number }>('SELECT id FROM companies WHERE owner_id = ?', [uid]);
  if (!c) throw new HttpError(409, 'Create your company profile first');
  return c.id;
}

const COMPANY_SQL = 'SELECT id, name, description, website, location, industry, size FROM companies WHERE owner_id = ?';

employerRouter.get('/company', wrap(async (req, res) => ok(res, (await one(COMPANY_SQL, [req.user!.id])) ?? null)));

employerRouter.put(
  '/company',
  wrap(async (req, res) => {
    const b = companySchema.parse(req.body);
    await exec(
      `INSERT INTO companies (owner_id, name, description, website, location, industry, size) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), website = VALUES(website),
       location = VALUES(location), industry = VALUES(industry), size = VALUES(size)`,
      [req.user!.id, b.name, b.description, b.website ?? null, b.location, b.industry, b.size],
    );
    ok(res, await one(COMPANY_SQL, [req.user!.id]));
  }),
);

// ---- jobs
const JOB_ROW = `j.id, j.title, j.location, j.status, j.moderation, j.views, j.featured, j.created_at AS createdAt,
  j.expires_at AS expiresAt, j.employment_type AS employmentType, j.experience_level AS experienceLevel,
  j.salary_min AS salaryMin, j.salary_max AS salaryMax, j.salary_currency AS salaryCurrency, j.category_id AS categoryId`;

const jobParams = (b: z.infer<typeof jobSchema>) => [
  b.title, b.description, b.requirements, b.location, b.categoryId, b.salaryMin ?? null, b.salaryMax ?? null,
  b.salaryCurrency, b.employmentType, b.experienceLevel, b.expiresAt ? new Date(b.expiresAt) : null,
];

async function assertCategory(id: number) {
  if (!(await one('SELECT id FROM categories WHERE id = ?', [id]))) {
    throw new HttpError(400, 'Validation failed', { categoryId: ['Unknown category'] });
  }
}

async function ownedJob(uid: number, id: number) {
  const j = await one<{ id: number; status: string; title: string; moderation: string }>(
    `SELECT j.id, j.status, j.title, j.moderation FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ? AND c.owner_id = ?`,
    [id, uid],
  );
  if (!j) throw new HttpError(404, 'Job not found');
  return j;
}

employerRouter.get(
  '/jobs',
  wrap(async (req, res) => {
    const f = z.object({ status: z.enum(JOB_STATUSES).optional(), ...paging }).parse(req.query);
    const p: unknown[] = [req.user!.id];
    let w = 'c.owner_id = ?';
    if (f.status) (w += ' AND j.status = ?', p.push(f.status));
    const total = (await one<{ n: number }>(`SELECT COUNT(*) AS n FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${w}`, p))?.n ?? 0;
    const data = await rows(
      `SELECT ${JOB_ROW}, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicationCount
       FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${w} ORDER BY j.created_at DESC, j.id DESC LIMIT ? OFFSET ?`,
      [...p, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data.map((j) => ({ ...j, featured: !!j.featured })), pageMeta(f.page, f.pageSize, total));
  }),
);

employerRouter.get(
  '/jobs/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    await ownedJob(req.user!.id, id);
    const job = await one(`SELECT ${JOB_ROW}, j.description, j.requirements FROM jobs j WHERE j.id = ?`, [id]);
    const skills = await rows<{ name: string }>(
      'SELECT s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = ? ORDER BY s.name', [id]);
    ok(res, { ...job, skills: skills.map((s) => s.name) });
  }),
);

employerRouter.post(
  '/jobs',
  wrap(async (req, res) => {
    const b = jobSchema.parse(req.body);
    const publish = z.object({ publish: z.boolean().optional() }).parse(req.body).publish === true;
    const companyId = await companyOf(req.user!.id);
    await assertCategory(b.categoryId);
    const id = await tx(async (c) => {
      const r = await exec(
        `INSERT INTO jobs (company_id, title, description, requirements, location, category_id, salary_min, salary_max,
          salary_currency, employment_type, experience_level, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, ...jobParams(b), publish ? 'active' : 'draft'],
        c,
      );
      await setJobSkills(r.insertId, b.skills, c);
      return r.insertId;
    });
    await audit(req, req.user!.id, 'job.created', 'job', id);
    ok(res, { id, status: publish ? 'active' : 'draft' }, undefined, 201);
  }),
);

employerRouter.put(
  '/jobs/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const b = jobSchema.parse(req.body);
    await ownedJob(req.user!.id, id);
    await assertCategory(b.categoryId);
    await tx(async (c) => {
      await exec(
        `UPDATE jobs SET title = ?, description = ?, requirements = ?, location = ?, category_id = ?, salary_min = ?,
         salary_max = ?, salary_currency = ?, employment_type = ?, experience_level = ?, expires_at = ? WHERE id = ?`,
        [...jobParams(b), id],
        c,
      );
      await setJobSkills(id, b.skills, c);
    });
    ok(res, { id });
  }),
);

employerRouter.post(
  '/jobs/:id/status',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = z.object({ status: z.enum(JOB_STATUSES) }).parse(req.body);
    const job = await ownedJob(req.user!.id, id);
    if (!canTransition(JOB_TRANSITIONS, job.status, status)) throw new HttpError(409, `Cannot change a ${job.status} job to ${status}`);
    if (status === 'active' && job.moderation === 'removed') {
      throw new HttpError(403, 'This listing was removed by moderation and cannot be published');
    }
    await exec('UPDATE jobs SET status = ? WHERE id = ?', [status, id]);
    await audit(req, req.user!.id, `job.${status}`, 'job', id);
    ok(res, { id, status });
  }),
);

employerRouter.delete(
  '/jobs/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    await ownedJob(req.user!.id, id);
    await exec('DELETE FROM jobs WHERE id = ?', [id]);
    await audit(req, req.user!.id, 'job.deleted', 'job', id);
    ok(res, { deleted: true });
  }),
);

// ---- applicants
const APP_SELECT = `a.id, a.status, a.rating, a.created_at AS createdAt, a.updated_at AS updatedAt, a.resume_name AS resumeName,
  j.id AS jobId, j.title AS jobTitle, u.id AS seekerId, u.full_name AS seekerName, u.email AS seekerEmail`;
const APP_FROM = `FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id JOIN users u ON u.id = a.seeker_id`;

const appFilter = z.object({ status: z.string().optional(), jobId: z.coerce.number().int().positive().optional(), q: z.string().trim().max(100).optional() });

function buildAppWhere(uid: number, f: z.infer<typeof appFilter>) {
  const p: unknown[] = [uid];
  let w = 'c.owner_id = ?';
  if (f.status) (w += ' AND a.status = ?', p.push(f.status));
  if (f.jobId) (w += ' AND a.job_id = ?', p.push(f.jobId));
  if (f.q) {
    const l = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`;
    w += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
    p.push(l, l);
  }
  return { w, p };
}

employerRouter.get(
  '/applications',
  wrap(async (req, res) => {
    const f = appFilter.extend({ ...paging, pageSize: z.coerce.number().int().min(1).max(100).default(10) }).parse(req.query);
    const { w, p } = buildAppWhere(req.user!.id, f);
    const total = (await one<{ n: number }>(`SELECT COUNT(*) AS n ${APP_FROM} WHERE ${w}`, p))?.n ?? 0;
    const data = await rows(`SELECT ${APP_SELECT} ${APP_FROM} WHERE ${w} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [
      ...p, f.pageSize, (f.page - 1) * f.pageSize,
    ]);
    ok(res, data, pageMeta(f.page, f.pageSize, total));
  }),
);

// Declared before "/applications/:id" so it is not parsed as an id.
employerRouter.get(
  '/applications-export.csv',
  wrap(async (req, res) => {
    const f = appFilter.parse(req.query);
    const { w, p } = buildAppWhere(req.user!.id, f);
    const data = await rows(`SELECT ${APP_SELECT} ${APP_FROM} WHERE ${w} ORDER BY a.created_at DESC LIMIT 5000`, p);
    const head = ['ID', 'Candidate', 'Email', 'Job', 'Status', 'Rating', 'Applied (UTC)'];
    const lines = [head.map(csvCell).join(',')];
    for (const r of data) {
      lines.push([r.id, r.seekerName, r.seekerEmail, r.jobTitle, r.status, r.rating ?? '', new Date(r.createdAt).toISOString()].map(csvCell).join(','));
    }
    await audit(req, req.user!.id, 'applications.exported', undefined, undefined, { rows: data.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
    res.send('\uFEFF' + lines.join('\r\n'));
  }),
);

async function ownedApplication(uid: number, id: number) {
  const a = await one<{ id: number }>(
    `SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id WHERE a.id = ? AND c.owner_id = ?`,
    [id, uid],
  );
  if (!a) throw new HttpError(404, 'Application not found');
}

employerRouter.get(
  '/applications/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const a = await one(
      `SELECT ${APP_SELECT}, a.cover_letter AS coverLetter, sp.headline, sp.phone, sp.location, sp.bio, sp.skills
       ${APP_FROM} LEFT JOIN seeker_profiles sp ON sp.user_id = a.seeker_id WHERE a.id = ? AND c.owner_id = ?`,
      [id, req.user!.id],
    );
    if (!a) throw new HttpError(404, 'Application not found');
    const events = await rows(
      'SELECT from_status AS fromStatus, to_status AS toStatus, created_at AS createdAt FROM application_events WHERE application_id = ? ORDER BY id', [id]);
    const notes = await rows(
      `SELECT n.id, n.note, n.created_at AS createdAt, u.full_name AS author FROM application_notes n
       LEFT JOIN users u ON u.id = n.author_id WHERE n.application_id = ? ORDER BY n.id DESC`, [id]);
    ok(res, { ...a, events, notes });
  }),
);

employerRouter.put(
  '/applications/:id/status',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const info = await tx(async (c) => {
      const a = await one<{ status: string; seeker_id: number; title: string; email: string; company: string }>(
        `SELECT a.status, a.seeker_id, j.title, u.email, co.name AS company FROM applications a JOIN jobs j ON j.id = a.job_id
         JOIN companies co ON co.id = j.company_id JOIN users u ON u.id = a.seeker_id WHERE a.id = ? AND co.owner_id = ? FOR UPDATE`,
        [id, req.user!.id], c);
      if (!a) throw new HttpError(404, 'Application not found');
      if (!canTransition(EMPLOYER_APP_TRANSITIONS, a.status, status)) throw new HttpError(409, `Cannot move an application from ${a.status} to ${status}`);
      await exec('UPDATE applications SET status = ? WHERE id = ?', [status, id], c);
      await exec('INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES (?, ?, ?, ?)', [id, a.status, status, req.user!.id], c);
      return a;
    });
    const pretty = status.replace('_', ' ');
    await notify(info.seeker_id, `Your application for "${info.title}" is now ${pretty}`, '/seeker?tab=applications');
    sendMail(info.email, `Application update: ${info.title}`, `Your application for "${info.title}" at ${info.company} is now: ${pretty}.\n\nTrack it in your dashboard.`);
    ok(res, { id, status });
  }),
);

employerRouter.put(
  '/applications/:id/rating',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { rating } = z.object({ rating: z.number().int().min(1).max(5).nullable() }).parse(req.body);
    await ownedApplication(req.user!.id, id);
    await exec('UPDATE applications SET rating = ? WHERE id = ?', [rating, id]);
    ok(res, { id, rating });
  }),
);

employerRouter.post(
  '/applications/:id/notes',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const { note } = z.object({ note: z.string().trim().min(1).max(2000) }).parse(req.body);
    await ownedApplication(req.user!.id, id);
    const r = await exec('INSERT INTO application_notes (application_id, author_id, note) VALUES (?, ?, ?)', [id, req.user!.id, note]);
    ok(res, { id: r.insertId }, undefined, 201);
  }),
);

employerRouter.get(
  '/stats',
  wrap(async (req, res) => {
    const uid = req.user!.id;
    const toMap = (r: { status: string; n: number }[]) => Object.fromEntries(r.map((x) => [x.status, x.n]));
    const jobs = await rows<{ status: string; n: number }>(
      `SELECT j.status, COUNT(*) AS n FROM jobs j JOIN companies c ON c.id = j.company_id WHERE c.owner_id = ? GROUP BY j.status`, [uid]);
    const apps = await rows<{ status: string; n: number }>(
      `SELECT a.status, COUNT(*) AS n ${APP_FROM} WHERE c.owner_id = ? GROUP BY a.status`, [uid]);
    const views = (await one<{ n: number }>(
      `SELECT CAST(COALESCE(SUM(j.views), 0) AS UNSIGNED) AS n FROM jobs j JOIN companies c ON c.id = j.company_id WHERE c.owner_id = ?`, [uid]))?.n ?? 0;
    const perJob = await rows(
      `SELECT j.id, j.title, j.status, j.views, COUNT(a.id) AS applications FROM jobs j JOIN companies c ON c.id = j.company_id
       LEFT JOIN applications a ON a.job_id = j.id WHERE c.owner_id = ? GROUP BY j.id, j.title, j.status, j.views
       ORDER BY applications DESC, j.id DESC LIMIT 5`, [uid]);
    const daily = await rows<{ d: string; n: number }>(
      `SELECT DATE_FORMAT(a.created_at, '%Y-%m-%d') AS d, COUNT(*) AS n ${APP_FROM}
       WHERE c.owner_id = ? AND a.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) GROUP BY d`, [uid]);
    const applications = toMap(apps);
    const total = Object.values(applications).reduce((x, y) => x + y, 0);
    ok(res, {
      jobs: toMap(jobs), applications, topJobs: perJob, totalViews: views, totalApplications: total,
      conversionRate: views > 0 ? Math.round((total / views) * 1000) / 10 : 0,
      applicationsPerDay: fillDays(daily, 30),
    });
  }),
);

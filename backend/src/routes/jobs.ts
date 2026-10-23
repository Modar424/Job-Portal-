import { Router } from 'express';
import { z } from 'zod';
import { exec, one, rows } from '../db/pool.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { audit } from '../modules/audit.js';
import { paging, reportSchema } from '../modules/schemas.js';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../utils/domain.js';
import { escapeLike, ok, pageMeta, parseId, wrap } from '../utils/http.js';
import { JOB_CARD, PUBLIC_JOB, shapeJob } from '../utils/sql.js';
import { logger } from '../utils/logger.js';

export const jobsRouter = Router();

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  type: z.enum(EMPLOYMENT_TYPES).optional(),
  level: z.enum(EXPERIENCE_LEVELS).optional(),
  skill: z.string().trim().max(30).optional(),
  salaryMin: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['newest', 'relevance', 'salary_desc', 'salary_asc']).default('newest'),
  ...paging,
});

const FROM = `FROM jobs j JOIN companies c ON c.id = j.company_id LEFT JOIN categories cat ON cat.id = j.category_id`;

let statsCache: { at: number; data: unknown } | null = null;
jobsRouter.get(
  '/stats',
  wrap(async (_req, res) => {
    if (!statsCache || Date.now() - statsCache.at > 60_000) {
      const n = async (sql: string) => (await one<{ n: number }>(sql))?.n ?? 0;
      statsCache = {
        at: Date.now(),
        data: {
          activeJobs: await n(`SELECT COUNT(*) AS n FROM jobs j WHERE ${PUBLIC_JOB}`),
          companies: await n('SELECT COUNT(*) AS n FROM companies'),
          candidates: await n("SELECT COUNT(*) AS n FROM users WHERE role = 'seeker' AND status = 'active'"),
        },
      };
    }
    ok(res, statsCache.data);
  }),
);

jobsRouter.get('/categories', wrap(async (_req, res) => ok(res, await rows('SELECT id, name FROM categories ORDER BY name'))));

jobsRouter.get(
  '/skills',
  wrap(async (req, res) => {
    const q = z.string().trim().max(30).default('').parse(req.query.q ?? '');
    ok(
      res,
      await rows<{ name: string }>(
        `SELECT s.name FROM skills s JOIN job_skills js ON js.skill_id = s.id WHERE s.name LIKE ? GROUP BY s.id, s.name
         ORDER BY COUNT(*) DESC, s.name LIMIT 10`,
        [`${escapeLike(q)}%`],
      ).then((r) => r.map((x) => x.name)),
    );
  }),
);

jobsRouter.get(
  '/',
  wrap(async (req, res) => {
    const f = listSchema.parse(req.query);
    const where = [PUBLIC_JOB];
    const p: unknown[] = [];
    if (f.q) {
      const like = `%${escapeLike(f.q)}%`;
      const parts = [
        'j.title LIKE ?',
        'c.name LIKE ?',
        'cat.name LIKE ?',
        'EXISTS (SELECT 1 FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = j.id AND s.name LIKE ?)',
      ];
      p.push(like, like, like, like);
      if (f.q.length >= 3) {
        parts.push('MATCH(j.title, j.description) AGAINST (? IN NATURAL LANGUAGE MODE)');
        p.push(f.q);
      }
      where.push(`(${parts.join(' OR ')})`);
    }
    if (f.location) (where.push('j.location LIKE ?'), p.push(`%${escapeLike(f.location)}%`));
    if (f.categoryId) (where.push('j.category_id = ?'), p.push(f.categoryId));
    if (f.type) (where.push('j.employment_type = ?'), p.push(f.type));
    if (f.level) (where.push('j.experience_level = ?'), p.push(f.level));
    if (f.salaryMin != null) (where.push('j.salary_max >= ?'), p.push(f.salaryMin));
    if (f.skill) {
      where.push('EXISTS (SELECT 1 FROM job_skills js JOIN skills s ON s.id = js.skill_id WHERE js.job_id = j.id AND s.name = ?)');
      p.push(f.skill);
    }
    const w = where.join(' AND ');
    const orderParams: unknown[] = [];
    let order: string;
    if (f.sort === 'relevance' && f.q && f.q.length >= 3) {
      order = 'j.featured DESC, MATCH(j.title, j.description) AGAINST (? IN NATURAL LANGUAGE MODE) DESC, j.created_at DESC';
      orderParams.push(f.q);
    } else if (f.sort === 'salary_desc') order = 'COALESCE(j.salary_max, 0) DESC, j.id DESC';
    else if (f.sort === 'salary_asc') order = 'COALESCE(j.salary_min, 4294967295) ASC, j.id DESC';
    else order = 'j.featured DESC, j.created_at DESC, j.id DESC';

    const total = (await one<{ n: number }>(`SELECT COUNT(*) AS n ${FROM} WHERE ${w}`, p))?.n ?? 0;
    const data = await rows(`SELECT ${JOB_CARD} ${FROM} WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...p, ...orderParams, f.pageSize, (f.page - 1) * f.pageSize,
    ]);
    ok(res, data.map(shapeJob), pageMeta(f.page, f.pageSize, total));
  }),
);

jobsRouter.get(
  '/:id',
  optionalAuth,
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const job = await one(
      `SELECT ${JOB_CARD}, j.description, j.requirements, j.moderation, (${PUBLIC_JOB}) AS isOpen,
        c.description AS companyDescription, c.website AS companyWebsite, c.industry AS companyIndustry,
        c.size AS companySize, c.owner_id AS ownerId, j.category_id AS categoryId
       ${FROM} WHERE j.id = ?`,
      [id],
    );
    if (!job) throw new HttpError(404, 'Job not found');
    const u = req.user;
    const isOwnerOrAdmin = !!u && (u.role === 'admin' || u.id === job.ownerId);
    // Drafts and moderated-out listings are only visible to the owner and administrators.
    if ((job.status === 'draft' || job.moderation === 'removed') && !isOwnerOrAdmin) throw new HttpError(404, 'Job not found');
    if (!isOwnerOrAdmin) {
      exec('UPDATE jobs SET views = views + 1 WHERE id = ?', [id]).catch((err) => logger.warn({ err }, 'view count failed'));
    }
    let saved = false;
    let application: unknown = null;
    let reported = false;
    if (u?.role === 'seeker') {
      saved = !!(await one('SELECT 1 AS x FROM saved_jobs WHERE user_id = ? AND job_id = ?', [u.id, id]));
      application = (await one('SELECT id, status FROM applications WHERE job_id = ? AND seeker_id = ?', [id, u.id])) ?? null;
      reported = !!(await one('SELECT 1 AS x FROM job_reports WHERE job_id = ? AND reporter_id = ?', [id, u.id]));
    }
    const { ownerId, ...pub } = shapeJob(job);
    void ownerId;
    ok(res, { ...pub, isOpen: !!pub.isOpen, saved, application, reported });
  }),
);

jobsRouter.get(
  '/:id/similar',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const j = await one<{ category_id: number }>('SELECT category_id FROM jobs WHERE id = ?', [id]);
    if (!j) return ok(res, []);
    const data = await rows(
      `SELECT ${JOB_CARD} ${FROM} WHERE ${PUBLIC_JOB} AND j.category_id = ? AND j.id <> ? ORDER BY j.created_at DESC LIMIT 4`,
      [j.category_id, id],
    );
    ok(res, data.map(shapeJob));
  }),
);

jobsRouter.post(
  '/:id/report',
  authenticate,
  requireRole('seeker'),
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const b = reportSchema.parse(req.body);
    if (!(await one('SELECT id FROM jobs WHERE id = ? AND status <> ?', [id, 'draft']))) throw new HttpError(404, 'Job not found');
    const r = await exec('INSERT INTO job_reports (job_id, reporter_id, reason, details) VALUES (?, ?, ?, ?)', [
      id, req.user!.id, b.reason, b.details || null,
    ]).catch((e) => {
      if (e?.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already reported this job');
      throw e;
    });
    await audit(req, req.user!.id, 'job.reported', 'job', id, { reason: b.reason });
    ok(res, { id: r.insertId }, undefined, 201);
  }),
);

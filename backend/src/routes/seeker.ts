import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { exec, one, rows, tx } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { removeUpload, upload, uploadPath, verifyUpload } from '../middleware/upload.js';
import { notify } from '../modules/notify.js';
import { paging, profileSchema } from '../modules/schemas.js';
import { WITHDRAWABLE } from '../utils/domain.js';
import { ok, pageMeta, parseId, wrap } from '../utils/http.js';
import { JOB_CARD, PUBLIC_JOB, shapeJob } from '../utils/sql.js';

export const seekerRouter = Router();
seekerRouter.use(authenticate, requireRole('seeker'));

const PROFILE_SQL = `SELECT u.full_name AS fullName, u.email, p.headline, p.phone, p.location, p.bio, p.skills,
  p.resume_name AS resumeName FROM users u LEFT JOIN seeker_profiles p ON p.user_id = u.id WHERE u.id = ?`;

seekerRouter.get('/profile', wrap(async (req, res) => ok(res, await one(PROFILE_SQL, [req.user!.id]))));

seekerRouter.put(
  '/profile',
  wrap(async (req, res) => {
    const b = profileSchema.parse(req.body);
    const uid = req.user!.id;
    await tx(async (c) => {
      await exec('UPDATE users SET full_name = ? WHERE id = ?', [b.fullName, uid], c);
      await exec(
        `INSERT INTO seeker_profiles (user_id, headline, phone, location, bio, skills) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE headline = VALUES(headline), phone = VALUES(phone),
         location = VALUES(location), bio = VALUES(bio), skills = VALUES(skills)`,
        [uid, b.headline, b.phone, b.location, b.bio, b.skills],
        c,
      );
    });
    ok(res, await one(PROFILE_SQL, [uid]));
  }),
);

seekerRouter.post(
  '/resume',
  upload.single('resume'),
  wrap(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Resume file is required');
    verifyUpload(req.file);
    const uid = req.user!.id;
    const old = await one<{ resume_file: string | null }>('SELECT resume_file FROM seeker_profiles WHERE user_id = ?', [uid]);
    await exec(
      `INSERT INTO seeker_profiles (user_id, resume_file, resume_name) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE resume_file = VALUES(resume_file), resume_name = VALUES(resume_name)`,
      [uid, req.file.filename, req.file.originalname.slice(0, 255)],
    );
    // Keep the file if an application still references it.
    if (old?.resume_file && !(await one('SELECT 1 AS x FROM applications WHERE resume_file = ? LIMIT 1', [old.resume_file]))) {
      removeUpload(old.resume_file);
    }
    ok(res, { resumeName: req.file.originalname });
  }),
);

// ---- saved jobs
seekerRouter.get(
  '/saved',
  wrap(async (req, res) => {
    ok(
      res,
      (await rows(
        `SELECT ${JOB_CARD}, s.created_at AS savedAt FROM saved_jobs s JOIN jobs j ON j.id = s.job_id
         JOIN companies c ON c.id = j.company_id LEFT JOIN categories cat ON cat.id = j.category_id
         WHERE s.user_id = ? ORDER BY s.created_at DESC`,
        [req.user!.id],
      )).map(shapeJob),
    );
  }),
);

seekerRouter.put(
  '/saved/:jobId',
  wrap(async (req, res) => {
    const jobId = parseId(req.params.jobId);
    if (!(await one(`SELECT j.id FROM jobs j WHERE j.id = ? AND ${PUBLIC_JOB}`, [jobId]))) {
      throw new HttpError(404, 'Job not found');
    }
    await exec('INSERT IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)', [req.user!.id, jobId]);
    ok(res, { saved: true });
  }),
);

seekerRouter.delete(
  '/saved/:jobId',
  wrap(async (req, res) => {
    await exec('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [req.user!.id, parseId(req.params.jobId)]);
    ok(res, { saved: false });
  }),
);

// ---- applications
const applySchema = z.object({ coverLetter: z.string().trim().max(5000).optional() });

seekerRouter.post(
  '/jobs/:jobId/apply',
  upload.single('resume'),
  wrap(async (req, res) => {
    const file = req.file;
    try {
      const jobId = parseId(req.params.jobId);
      const uid = req.user!.id;
      const body = applySchema.parse(req.body ?? {});
      const job = await one<{ id: number; title: string; owner_id: number }>(
        `SELECT j.id, j.title, c.owner_id FROM jobs j JOIN companies c ON c.id = j.company_id
         WHERE j.id = ? AND ${PUBLIC_JOB}`,
        [jobId],
      );
      if (!job) throw new HttpError(404, 'Job not found or no longer accepting applications');
      if (await one('SELECT id FROM applications WHERE job_id = ? AND seeker_id = ?', [jobId, uid])) {
        throw new HttpError(409, 'You have already applied to this job');
      }
      let resumeFile: string;
      let resumeName: string;
      if (file) {
        verifyUpload(file);
        resumeFile = file.filename;
        resumeName = file.originalname.slice(0, 255);
      } else {
        const p = await one<{ resume_file: string | null; resume_name: string | null }>(
          'SELECT resume_file, resume_name FROM seeker_profiles WHERE user_id = ?', [uid]);
        if (!p?.resume_file || !p.resume_name) {
          throw new HttpError(400, 'A resume is required', { resume: ['Upload a resume or attach one to your profile'] });
        }
        // Copy so later profile changes never alter or delete a submitted application's file.
        const copy = `${p.resume_file.replace(/\.[^.]+$/, '')}-${Date.now()}${p.resume_file.slice(p.resume_file.lastIndexOf('.'))}`;
        fs.copyFileSync(uploadPath(p.resume_file), uploadPath(copy));
        resumeFile = copy;
        resumeName = p.resume_name;
      }
      const id = await tx(async (c) => {
        const r = await exec(
          'INSERT INTO applications (job_id, seeker_id, cover_letter, resume_file, resume_name) VALUES (?, ?, ?, ?, ?)',
          [jobId, uid, body.coverLetter || null, resumeFile, resumeName],
          c,
        );
        await exec('INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES (?, NULL, ?, ?)',
          [r.insertId, 'pending', uid], c);
        return r.insertId;
      });
      await notify(job.owner_id, `New application for "${job.title}"`, '/employer?tab=applicants');
      ok(res, { id, status: 'pending' }, undefined, 201);
    } catch (e) {
      if (file) removeUpload(file.filename);
      throw e;
    }
  }),
);

const listSchema = z.object({ status: z.string().optional(), ...paging });

seekerRouter.get(
  '/applications',
  wrap(async (req, res) => {
    const f = listSchema.parse(req.query);
    const p: unknown[] = [req.user!.id];
    let w = 'a.seeker_id = ?';
    if (f.status) (w += ' AND a.status = ?', p.push(f.status));
    const total = (await one<{ n: number }>(`SELECT COUNT(*) AS n FROM applications a WHERE ${w}`, p))?.n ?? 0;
    const data = await rows(
      `SELECT a.id, a.status, a.created_at AS createdAt, a.updated_at AS updatedAt, j.id AS jobId, j.title,
        c.name AS companyName, j.location FROM applications a JOIN jobs j ON j.id = a.job_id
        JOIN companies c ON c.id = j.company_id WHERE ${w} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...p, f.pageSize, (f.page - 1) * f.pageSize],
    );
    ok(res, data, pageMeta(f.page, f.pageSize, total));
  }),
);

seekerRouter.get(
  '/applications/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const a = await one(
      `SELECT a.id, a.status, a.cover_letter AS coverLetter, a.resume_name AS resumeName, a.created_at AS createdAt,
        j.id AS jobId, j.title, c.name AS companyName FROM applications a JOIN jobs j ON j.id = a.job_id
        JOIN companies c ON c.id = j.company_id WHERE a.id = ? AND a.seeker_id = ?`,
      [id, req.user!.id],
    );
    if (!a) throw new HttpError(404, 'Application not found');
    const events = await rows(
      'SELECT from_status AS fromStatus, to_status AS toStatus, created_at AS createdAt FROM application_events WHERE application_id = ? ORDER BY id',
      [id],
    );
    ok(res, { ...a, events });
  }),
);

seekerRouter.post(
  '/applications/:id/withdraw',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const uid = req.user!.id;
    const result = await tx(async (c) => {
      const a = await one<{ status: string; title: string; owner_id: number }>(
        `SELECT a.status, j.title, co.owner_id FROM applications a JOIN jobs j ON j.id = a.job_id
         JOIN companies co ON co.id = j.company_id WHERE a.id = ? AND a.seeker_id = ? FOR UPDATE`,
        [id, uid], c);
      if (!a) throw new HttpError(404, 'Application not found');
      if (!WITHDRAWABLE.includes(a.status)) throw new HttpError(409, `Cannot withdraw an application that is ${a.status}`);
      await exec("UPDATE applications SET status = 'withdrawn' WHERE id = ?", [id], c);
      await exec('INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES (?, ?, ?, ?)',
        [id, a.status, 'withdrawn', uid], c);
      return a;
    });
    await notify(result.owner_id, `An applicant withdrew from "${result.title}"`, '/employer?tab=applicants');
    ok(res, { status: 'withdrawn' });
  }),
);

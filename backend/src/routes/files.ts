import fs from 'node:fs';
import { Router } from 'express';
import { one } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { uploadPath } from '../middleware/upload.js';
import { parseId, wrap } from '../utils/http.js';

export const filesRouter = Router();
filesRouter.use(authenticate);

function send(res: import('express').Response, file: string, name: string) {
  const p = uploadPath(file);
  if (!fs.existsSync(p)) throw new HttpError(404, 'File not found');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(p, name);
}

// Own profile resume.
filesRouter.get(
  '/me/resume',
  wrap(async (req, res) => {
    const p = await one<{ resume_file: string | null; resume_name: string | null }>(
      'SELECT resume_file, resume_name FROM seeker_profiles WHERE user_id = ?', [req.user!.id]);
    if (!p?.resume_file) throw new HttpError(404, 'File not found');
    send(res, p.resume_file, p.resume_name ?? 'resume');
  }),
);

// Application resume: the applicant, the employer owning the job, or an admin.
filesRouter.get(
  '/applications/:id/resume',
  wrap(async (req, res) => {
    const a = await one<{ resume_file: string; resume_name: string; seeker_id: number; owner_id: number }>(
      `SELECT a.resume_file, a.resume_name, a.seeker_id, c.owner_id FROM applications a
       JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id WHERE a.id = ?`,
      [parseId(req.params.id)],
    );
    const u = req.user!;
    const allowed = a && (u.role === 'admin' || a.seeker_id === u.id || a.owner_id === u.id);
    if (!a || !allowed) throw new HttpError(404, 'File not found'); // do not reveal existence
    send(res, a.resume_file, a.resume_name);
  }),
);

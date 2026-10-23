import { Router } from 'express';
import { one, rows } from '../db/pool.js';
import { HttpError } from '../middleware/errors.js';
import { ok, parseId, wrap } from '../utils/http.js';
import { JOB_CARD, PUBLIC_JOB, shapeJob } from '../utils/sql.js';

export const companiesRouter = Router();

companiesRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const c = await one('SELECT id, name, description, website, location, industry, size FROM companies WHERE id = ?', [id]);
    if (!c) throw new HttpError(404, 'Company not found');
    const jobs = await rows(
      `SELECT ${JOB_CARD} FROM jobs j JOIN companies c ON c.id = j.company_id LEFT JOIN categories cat ON cat.id = j.category_id
       WHERE j.company_id = ? AND ${PUBLIC_JOB} ORDER BY j.created_at DESC LIMIT 50`,
      [id],
    );
    ok(res, { ...c, jobs: jobs.map(shapeJob) });
  }),
);

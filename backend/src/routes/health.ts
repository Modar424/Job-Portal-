import { Router } from 'express';
import { pingDb } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const db = await pingDb();
  res.status(db ? 200 : 503).json({ success: true, data: { status: db ? 'ok' : 'degraded', db } });
});

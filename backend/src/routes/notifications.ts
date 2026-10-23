import { Router } from 'express';
import { exec, one, rows } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { ok, parseId, wrap } from '../utils/http.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  wrap(async (req, res) => {
    const uid = req.user!.id;
    const items = await rows(
      'SELECT id, message, link, is_read AS isRead, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30',
      [uid],
    );
    const unread = (await one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [uid]))?.n ?? 0;
    ok(res, { items: items.map((i) => ({ ...i, isRead: !!i.isRead })), unread });
  }),
);

notificationsRouter.post(
  '/read-all',
  wrap(async (req, res) => {
    await exec('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
    ok(res, { done: true });
  }),
);

notificationsRouter.post(
  '/:id/read',
  wrap(async (req, res) => {
    await exec('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [parseId(req.params.id), req.user!.id]);
    ok(res, { done: true });
  }),
);

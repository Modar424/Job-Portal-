import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../middleware/errors.js';

export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function ok(res: Response, data: unknown, meta?: unknown, status = 200) {
  return res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function parseId(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export const pageMeta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

export const pagingSchemaShape = { page: 1, pageSize: 10 };

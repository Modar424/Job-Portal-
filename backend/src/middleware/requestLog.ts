import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export function requestLog(req: Request, res: Response, next: NextFunction) {
  const id = (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].slice(0, 64)) || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({ reqId: id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), userId: req.user?.id }, 'request');
  });
  next();
}

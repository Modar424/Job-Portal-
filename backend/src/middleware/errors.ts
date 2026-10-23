import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const fail = (res: Response, status: number, message: string, details?: unknown) =>
  res.status(status).json({ success: false, error: { message, details, requestId: res.getHeader('X-Request-Id') } });

export function notFound(_req: Request, res: Response) {
  fail(res, 404, 'Not found');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return fail(res, 400, 'Validation failed', err.flatten().fieldErrors);
  if (err instanceof HttpError) return fail(res, err.status, err.message, err.details);
  if (err instanceof MulterError) {
    return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : 'Invalid upload');
  }
  const e = err as { code?: string; type?: string };
  if (e?.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Resource already exists');
  if (e?.type === 'entity.parse.failed') return fail(res, 400, 'Malformed JSON body');
  if (e?.type === 'entity.too.large') return fail(res, 413, 'Request body too large');
  logger.error({ err, reqId: req.id, path: req.path }, 'unhandled error');
  return fail(res, 500, 'Internal server error');
}

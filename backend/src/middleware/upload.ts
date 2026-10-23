import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from './errors.js';

export const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + (ALLOWED[file.mimetype] ?? '.bin')),
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new HttpError(400, 'Only PDF, DOC or DOCX files are allowed'));
    cb(null, true);
  },
});

export function magicMatches(buf: Buffer, ext: string): boolean {
  if (ext === '.pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === '.docx') return buf[0] === 0x50 && buf[1] === 0x4b;
  if (ext === '.doc') return buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  return false;
}

/** Verifies file signature; removes the file and throws if it does not match its declared type. */
export function verifyUpload(file: Express.Multer.File) {
  const fd = fs.openSync(file.path, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  if (!magicMatches(buf, path.extname(file.filename))) {
    removeUpload(file.filename);
    throw new HttpError(400, 'File content does not match its type');
  }
}

export function removeUpload(name?: string | null) {
  if (!name || name !== path.basename(name)) return;
  fs.rm(path.join(uploadDir, name), { force: true }, () => undefined);
}

export function uploadPath(name: string) {
  const safe = path.basename(name);
  return path.join(uploadDir, safe);
}

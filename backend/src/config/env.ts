import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the single .env at the project root, whatever directory the process starts from.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const DEV_SECRET = 'dev-only-secret-change-me-please';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().default('jobportal'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('jobportal'),
    SESSION_SECRET: z.string().min(16).default(DEV_SECRET),
    UPLOAD_DIR: z.string().default('./uploads'),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('HireNest <no-reply@hirenest.local>'),
    SEED_PASSWORD: z.string().default('Demo1234!'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.SESSION_SECRET !== DEV_SECRET, {
    message: 'SESSION_SECRET must be set to a strong random value in production',
    path: ['SESSION_SECRET'],
  });

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';

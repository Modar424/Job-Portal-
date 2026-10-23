import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requestLog } from './middleware/requestLog.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { companiesRouter } from './routes/companies.js';
import { employerRouter } from './routes/employer.js';
import { filesRouter } from './routes/files.js';
import { healthRouter } from './routes/health.js';
import { jobsRouter } from './routes/jobs.js';
import { notificationsRouter } from './routes/notifications.js';
import { seekerRouter } from './routes/seeker.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestLog);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/health', healthRouter);
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.NODE_ENV === 'test' ? 10000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: { message: 'Too many requests' } },
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/seeker', seekerRouter);
  app.use('/api/employer', employerRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/files', filesRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

import nodemailer from 'nodemailer';
import { env, isProd } from '../config/env.js';
import { logger } from '../utils/logger.js';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Fire-and-forget: mail problems never fail the request that triggered them. */
export function sendMail(to: string, subject: string, text: string) {
  void (async () => {
    try {
      if (!transport) {
        logger.info(isProd ? { to, subject } : { to, subject, text }, 'mail not sent: SMTP is not configured');
        return;
      }
      await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
    } catch (err) {
      logger.error({ err, to, subject }, 'mail delivery failed');
    }
  })();
}

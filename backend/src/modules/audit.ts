import type { Request } from 'express';
import { exec } from '../db/pool.js';
import { logger } from '../utils/logger.js';

export async function audit(
  req: Request | null,
  actorId: number | null,
  action: string,
  entityType?: string,
  entityId?: number,
  meta?: Record<string, unknown>,
) {
  try {
    await exec('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, meta, ip) VALUES (?, ?, ?, ?, ?, ?)', [
      actorId,
      action,
      entityType ?? null,
      entityId ?? null,
      meta ? JSON.stringify(meta) : null,
      req?.ip?.slice(0, 45) ?? null,
    ]);
  } catch (err) {
    logger.error({ err, action }, 'audit log write failed');
  }
}

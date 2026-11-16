import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { query } from '../../shared/utils/request-helpers.js';
import { AuditLog } from '../../database/models/audit-log.model.js';

export const listAuditLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; entityType?: string; actorId?: string; since?: string }>(req);
  const filter: Record<string, unknown> = {};
  if (q.entityType) filter.entityType = q.entityType;
  if (q.actorId && isValidObjectId(q.actorId)) filter.actorId = q.actorId;
  if (q.since) {
    const since = new Date(q.since);
    if (!Number.isNaN(since.getTime())) filter.createdAt = { $gte: since };
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('actorId', 'name email role'),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: q.page, limit: q.limit });
});

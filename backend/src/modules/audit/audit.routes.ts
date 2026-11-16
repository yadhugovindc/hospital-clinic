import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { z } from 'zod';
import { listAuditLogsHandler } from './audit.controller.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  entityType: z.string().trim().max(60).optional(),
  actorId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  since: z.string().trim().optional(),
});

export const auditRouter = Router();

auditRouter.get('/', validate(listQuerySchema, 'query'), guard('audit:read'), asyncHandler(listAuditLogsHandler));

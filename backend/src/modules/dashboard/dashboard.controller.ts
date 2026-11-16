import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { getDashboardForRole } from './dashboard.service.js';

export const dashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  // Role-aware payload; unauthorized visits are already blocked by permission guards.
  const data = await getDashboardForRole(actor.role, actor.id);
  res.json(data);
});

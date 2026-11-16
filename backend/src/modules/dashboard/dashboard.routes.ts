import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { dashboardHandler } from './dashboard.controller.js';

export const dashboardRouter = Router();

// Any active, authenticated role gets a dashboard scoped to its own permissions.
dashboardRouter.get('/', authenticate, asyncHandler(dashboardHandler));

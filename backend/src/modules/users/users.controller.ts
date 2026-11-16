import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser, requireAdmin, type AuthenticatedRequest } from '../../shared/middleware/auth.js';
import { strParam } from '../../shared/utils/request-helpers.js';
import * as service from './users.service.js';
import { BadRequestError } from '../../shared/errors/api-error.js';
import type { Role } from '../../shared/utils/rbac.js';
import type { z } from 'zod';
import type {
  createSchema,
  updateSchema,
  statusSchema,
  listUsersQuerySchema,
} from './users.validation.js';

type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;
type StatusInput = z.infer<typeof statusSchema>;
type ListQuery = z.infer<typeof listUsersQuerySchema>;

export const listUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListQuery;
  const result = await service.listUsers(q);
  res.json(result);
});

export const listDoctorsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ doctors: await service.listDoctors() });
});

export const listTherapistsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ therapists: await service.listTherapists() });
});

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const input = req.body as CreateInput;
  const user = await service.createUser(input, actor.id);
  res.status(201).json({ user });
});

export const updateUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const input = req.body as UpdateInput;
  const user = await service.updateUser(strParam(req, 'id'), input, actor.id);
  res.json({ user });
});

export const setUserStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const { isActive } = req.body as StatusInput;
  const user = await service.setUserStatus(strParam(req, 'id'), isActive, actor.id, actor.role);
  res.json({ user });
});

export const mePermissionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = (req as AuthenticatedRequest).user;
  if (!session) throw new BadRequestError('Authentication required');
  void requireAdmin;
  res.json({ permissions: service.rolePermissions(session.role as Role) });
});

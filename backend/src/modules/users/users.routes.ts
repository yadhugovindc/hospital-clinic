import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  createUserHandler,
  listDoctorsHandler,
  listUsersHandler,
  listTherapistsHandler,
  mePermissionsHandler,
  setUserStatusHandler,
  updateUserHandler,
} from './users.controller.js';
import { createSchema, listUsersQuerySchema, statusSchema, updateSchema } from './users.validation.js';

export const usersRouter = Router();

usersRouter.get('/doctors', guard('patients:read'), asyncHandler(listDoctorsHandler));
usersRouter.get('/therapists', guard('procedures:read'), asyncHandler(listTherapistsHandler));
usersRouter.get('/me/permissions', guard('dashboard:read'), asyncHandler(mePermissionsHandler));

usersRouter.get('/', guard('users:read'), validate(listUsersQuerySchema, 'query'), asyncHandler(listUsersHandler));
usersRouter.post('/', guard('users:write'), validate(createSchema), asyncHandler(createUserHandler));
usersRouter.patch('/:id', guard('users:write'), validate(updateSchema), asyncHandler(updateUserHandler));
usersRouter.patch('/:id/status', guard('users:write'), validate(statusSchema), asyncHandler(setUserStatusHandler));

import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { getSettingsHandler, updateSettingsHandler } from './clinic.controller.js';
import { updateSettingsSchema } from './clinic.validation.js';

export const clinicRouter = Router();

clinicRouter.get('/', guard('clinic:read'), asyncHandler(getSettingsHandler));
clinicRouter.patch('/', guard('clinic:write'), validate(updateSettingsSchema), asyncHandler(updateSettingsHandler));

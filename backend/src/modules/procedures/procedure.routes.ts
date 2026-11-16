import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { idParams } from '../../shared/validation/schemas.js';
import {
  cancelProcedureBillHandler,
  createCatalogItemHandler,
  createPlanHandler,
  createProcedureBillHandler,
  getPlanHandler,
  getProcedureBillHandler,
  listCatalogHandler,
  listPlansHandler,
  listProcedureBillsHandler,
  listSessionsHandler,
  updateCatalogItemHandler,
  updateSessionHandler,
} from './procedure.controller.js';
import {
  createCatalogItemSchema,
  createPlanSchema,
  createProcedureBillSchema,
  planListSchema,
  sessionListSchema,
  sessionUpdateSchema,
  updateCatalogItemSchema,
} from './procedure.validation.js';

export const proceduresRouter = Router();

// Catalog
proceduresRouter.get('/catalog', guard('procedures:read'), asyncHandler(listCatalogHandler));
proceduresRouter.post('/catalog', guard('procedures:write'), validate(createCatalogItemSchema), asyncHandler(createCatalogItemHandler));
proceduresRouter.patch('/catalog/:id', guard('procedures:write'), validate(idParams, 'params'), validate(updateCatalogItemSchema), asyncHandler(updateCatalogItemHandler));

// Plans
proceduresRouter.post('/plans', guard('procedures:write'), validate(createPlanSchema), asyncHandler(createPlanHandler));
proceduresRouter.get('/plans', guard('procedures:read'), validate(planListSchema, 'query'), asyncHandler(listPlansHandler));
proceduresRouter.get('/plans/:id', guard('procedures:read'), validate(idParams, 'params'), asyncHandler(getPlanHandler));

// Sessions
proceduresRouter.get('/sessions', guard('procedures:read'), validate(sessionListSchema, 'query'), asyncHandler(listSessionsHandler));
proceduresRouter.patch('/sessions/:id', guard('procedures:write'), validate(idParams, 'params'), validate(sessionUpdateSchema), asyncHandler(updateSessionHandler));

// Bills
proceduresRouter.post('/bills', guard('procedure-bills:write'), validate(createProcedureBillSchema), asyncHandler(createProcedureBillHandler));
proceduresRouter.get('/bills', guard('procedures:read'), asyncHandler(listProcedureBillsHandler));
proceduresRouter.get('/bills/:id', guard('procedures:read'), validate(idParams, 'params'), asyncHandler(getProcedureBillHandler));
proceduresRouter.post('/bills/:id/cancel', guard('procedure-bills:write'), validate(idParams, 'params'), asyncHandler(cancelProcedureBillHandler));

import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { idParams, objectId } from '../../shared/validation/schemas.js';
import { z } from 'zod';
import {
  createIcdCodeHandler,
  createPrescriptionForVisitHandler,
  createVisitHandler,
  getPrescriptionHandler,
  getVisitHandler,
  listIcdCodesHandler,
  listVisitsHandler,
  patientHistoryHandler,
  patientPrescriptionsHandler,
  updatePrescriptionHandler,
  updateVisitHandler,
} from './clinical.controller.js';
import {
  createPrescriptionSchema,
  createVisitSchema,
  createIcdCodeSchema,
  updatePrescriptionSchema,
  updateVisitSchema,
  visitListSchema,
} from './clinical.validation.js';

const patientIdParams = z.object({ patientId: objectId });

export const doctorRouter = Router();

// Visits
doctorRouter.post('/visits', guard('clinical:write'), validate(createVisitSchema), asyncHandler(createVisitHandler));
doctorRouter.get('/visits', guard('clinical:read'), validate(visitListSchema, 'query'), asyncHandler(listVisitsHandler));
doctorRouter.get('/visits/:id', guard('clinical:read'), validate(idParams, 'params'), asyncHandler(getVisitHandler));
doctorRouter.patch('/visits/:id', guard('clinical:write'), validate(idParams, 'params'), validate(updateVisitSchema), asyncHandler(updateVisitHandler));

// Prescriptions
doctorRouter.post('/visits/:id/prescriptions', guard('clinical:write'), validate(idParams, 'params'), validate(createPrescriptionSchema), asyncHandler(createPrescriptionForVisitHandler));
doctorRouter.get('/prescriptions/:id', guard('clinical:read'), validate(idParams, 'params'), asyncHandler(getPrescriptionHandler));
doctorRouter.patch('/prescriptions/:id', guard('clinical:write'), validate(idParams, 'params'), validate(updatePrescriptionSchema), asyncHandler(updatePrescriptionHandler));

// Patient clinical history
doctorRouter.get('/patients/:patientId/history', guard('clinical:read'), validate(patientIdParams, 'params'), asyncHandler(patientHistoryHandler));
doctorRouter.get('/patients/:patientId/prescriptions', guard('clinical:read'), validate(patientIdParams, 'params'), asyncHandler(patientPrescriptionsHandler));

// ICD codes
doctorRouter.get('/icd-codes', guard('clinical:read'), asyncHandler(listIcdCodesHandler));
doctorRouter.post('/icd-codes', guard('clinical:write'), validate(createIcdCodeSchema), asyncHandler(createIcdCodeHandler));

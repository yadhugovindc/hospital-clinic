import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  checkDuplicatesHandler,
  createPatientHandler,
  getPatientHandler,
  searchPatientsHandler,
  updatePatientHandler,
} from './patient.controller.js';
import {
  bookTokenHandler,
  listTokensHandler,
  queueCountsHandler,
  updateTokenStatusHandler,
} from './token.controller.js';
import {
  bookTokenSchema,
  createPatientSchema,
  duplicateCheckSchema,
  patientSearchSchema,
  tokenListSchema,
  tokenStatusSchema,
  updatePatientSchema,
} from './reception.validation.js';
import { idParams } from '../../shared/validation/schemas.js';

export const receptionRouter = Router();

// Patients
receptionRouter.post('/patients', guard('patients:write'), validate(createPatientSchema), createPatientHandler);
receptionRouter.get('/patients', guard('patients:read'), validate(patientSearchSchema, 'query'), searchPatientsHandler);
receptionRouter.post('/patients/duplicates', guard('patients:write'), validate(duplicateCheckSchema), checkDuplicatesHandler);
receptionRouter.get('/patients/:id', guard('patients:read'), validate(idParams, 'params'), getPatientHandler);
receptionRouter.patch('/patients/:id', guard('patients:write'), validate(idParams, 'params'), validate(updatePatientSchema), updatePatientHandler);

// Tokens
receptionRouter.post('/tokens', guard('tokens:write'), validate(bookTokenSchema), bookTokenHandler);
receptionRouter.get('/tokens', guard('tokens:read'), validate(tokenListSchema, 'query'), listTokensHandler);
receptionRouter.get('/tokens/counts', guard('tokens:read'), asyncHandler(queueCountsHandler));
receptionRouter.patch('/tokens/:id/status', guard('tokens:write'), validate(idParams, 'params'), validate(tokenStatusSchema), updateTokenStatusHandler);

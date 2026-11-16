import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { query, strParam } from '../../shared/utils/request-helpers.js';
import * as visitService from './visit.service.js';
import * as prescriptionService from './prescription.service.js';
import { IcdCode } from '../../database/models/icd-code.model.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { Types } from 'mongoose';
import {
  createIcdCodeSchema,
  type CreatePrescriptionInput,
  type CreateVisitInput,
  type UpdatePrescriptionInput,
  type UpdateVisitInput,
  type VisitListInput,
} from './clinical.validation.js';

export const createVisitHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const visit = await visitService.createVisit(req.body as CreateVisitInput, actor);
  res.status(201).json({ visit });
});

export const listVisitsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const q = query<VisitListInput>(req);
  res.json(await visitService.listVisits(q, actor));
});

export const getVisitHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  res.json({ visit: await visitService.getAuthorizedVisit(strParam(req, 'id'), actor) });
});

export const updateVisitHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const visit = await visitService.updateVisit(strParam(req, 'id'), req.body as UpdateVisitInput, actor);
  res.json({ visit });
});

export const patientHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const history = await visitService.authorizedPatientHistory(strParam(req, 'patientId'), actor);
  res.json({ history });
});

export const createPrescriptionForVisitHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const prescription = await prescriptionService.createPrescription(req.body as CreatePrescriptionInput, actor);
  res.status(201).json({ prescription });
});

export const getPrescriptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  res.json({ prescription: await prescriptionService.getPrescriptionForActor(strParam(req, 'id'), actor) });
});

export const updatePrescriptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const prescription = await prescriptionService.updatePrescription(strParam(req, 'id'), req.body as UpdatePrescriptionInput, actor);
  res.json({ prescription });
});

export const patientPrescriptionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const prescriptions = await prescriptionService.listPrescriptionsForPatient(strParam(req, 'patientId'), actor);
  res.json({ prescriptions });
});

export const listIcdCodesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const codes = await IcdCode.find({ isActive: true }).sort({ code: 1 }).limit(2000);
  res.json({ codes });
});

export const createIcdCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const input = createIcdCodeSchema.parse(req.body);
  const code = await IcdCode.create({ code: input.code.toUpperCase(), description: input.description });
  recordAudit({
    actorId: new Types.ObjectId(actor.id) as never,
    actorEmail: actor.email,
    action: 'icd.create',
    entityType: 'IcdCode',
    entityId: String(code._id),
    after: { code: code.code },
  } as never);
  res.status(201).json({ code });
});

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { strParam } from '../../shared/utils/request-helpers.js';
import {
  createPatient,
  detectDuplicates,
  getPatient,
  searchPatients,
  updatePatient,
} from './patient.service.js';
import type {
  CreatePatientInput,
  DuplicateCheckInput,
  PatientSearchInput,
  UpdatePatientInput,
} from './reception.validation.js';

export const createPatientHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const patient = await createPatient(req.body as CreatePatientInput, actor.id, actor.email);
  res.status(201).json({ patient });
});

export const searchPatientsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as PatientSearchInput;
  res.json(await searchPatients(q));
});

export const getPatientHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ patient: await getPatient(strParam(req, 'id')) });
});

export const updatePatientHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const patient = await updatePatient(strParam(req, 'id'), req.body as UpdatePatientInput, actor.id, actor.email);
  res.json({ patient });
});

export const checkDuplicatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const candidates = await detectDuplicates(req.body as DuplicateCheckInput);
  res.json({
    duplicates: candidates.map((p) => ({ id: p._id, uhid: p.uhid, name: p.name, phone: p.phone, gender: p.gender })),
  });
});

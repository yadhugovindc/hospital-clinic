import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { query, strParam } from '../../shared/utils/request-helpers.js';
import * as service from './procedure.service.js';
import type {
  CreateCatalogInput,
  CreatePlanInputSchema,
  CreateProcBillInput,
  SessionUpdateInput,
} from './procedure.validation.js';

// ---- Catalog ----
export const createCatalogItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const item = await service.createCatalogItem(req.body as CreateCatalogInput, actor);
  void item;
  const fresh = await service.listCatalog(true);
  const created = fresh.find((i) => i.name === (req.body as CreateCatalogInput).name.trim());
  res.status(201).json({ procedure: created ?? item });
});

export const listCatalogHandler = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = (req.query as { includeInactive?: string }).includeInactive === 'true';
  res.json({ procedures: await service.listCatalog(includeInactive) });
});

export const updateCatalogItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const item = await service.updateCatalogItem(strParam(req, 'id'), req.body as Record<string, unknown>, actor);
  res.json({ procedure: item });
});

// ---- Plans ----
export const createPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const plan = await service.createPlan(req.body as CreatePlanInputSchema, actor);
  res.status(201).json({ plan });
});

export const listPlansHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; patientId?: string; status?: string; therapistId?: string }>(req);
  res.json(await service.listPlans(q));
});

export const getPlanHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getPlan(strParam(req, 'id')));
});

// ---- Sessions ----
export const updateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const session = await service.updateSession(strParam(req, 'id'), req.body as SessionUpdateInput, actor);
  res.json({ session });
});

export const listSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; scheduledDate?: string; therapistId?: string; status?: string; patientId?: string }>(req);
  res.json(await service.listSessions(q));
});

// ---- Bills ----
export const createProcedureBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const bill = await service.createProcedureBill(req.body as CreateProcBillInput, actor);
  res.status(201).json({ bill });
});

export const listProcedureBillsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; patientId?: string }>(req);
  res.json(await service.listProcedureBills(q));
});

export const getProcedureBillHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ bill: await service.getProcedureBill(strParam(req, 'id')) });
});

export const cancelProcedureBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length >= 3 ? req.body.reason : 'Cancelled by user';
  const bill = await service.cancelProcedureBill(strParam(req, 'id'), reason, actor);
  res.json({ bill });
});

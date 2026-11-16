import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { query, strParam } from '../../shared/utils/request-helpers.js';
import * as medicineService from './medicine.service.js';
import * as purchaseService from './purchase.service.js';
import * as inventoryService from './inventory.service.js';
import * as billingService from './billing.service.js';
import type {
  CreateBillInput,
  CreateMedicineInput,
  CreatePurchaseInput,
  CreateSupplierInput,
} from './pharmacy.validation.js';
import { updateMedicineSchema } from './pharmacy.validation.js';

// ---- Medicines ----
export const createMedicineHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const medicine = await medicineService.createMedicine(req.body as CreateMedicineInput, actor.id, actor.email);
  res.status(201).json({ medicine });
});

export const listMedicinesHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{
    page: number;
    limit: number;
    search?: string;
    category?: string;
    lowStock?: 'true' | 'false';
    includeInactive?: 'true' | 'false';
  }>(req);
  res.json(await medicineService.listMedicines({ ...q, lowStock: q.lowStock === 'true', includeInactive: q.includeInactive === 'true' }));
});

export const getMedicineHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ medicine: await medicineService.mustGetMedicine(strParam(req, 'id')) });
});

export const updateMedicineHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const input = updateMedicineSchema.parse(req.body);
  const medicine = await medicineService.updateMedicine(strParam(req, 'id'), input, actor.id, actor.email);
  res.json({ medicine });
});

export const medicineStockHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await medicineService.getMedicineStock(strParam(req, 'id')));
});

// ---- Suppliers ----
export const createSupplierHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const supplier = await medicineService.createSupplier(req.body as CreateSupplierInput, actor.id, actor.email);
  res.status(201).json({ supplier });
});

export const listSuppliersHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ suppliers: await medicineService.listSuppliers() });
});

export const updateSupplierHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const supplier = await medicineService.updateSupplier(strParam(req, 'id'), req.body as medicineService.SupplierUpdateInput, actor.id, actor.email);
  res.json({ supplier });
});

// ---- Purchases ----
export const createPurchaseHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const purchase = await purchaseService.createPurchase(req.body as CreatePurchaseInput, actor);
  res.status(201).json({ purchase });
});

export const listPurchasesHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; supplierId?: string; purchaseDate?: string }>(req);
  res.json(await purchaseService.listPurchases(q));
});

export const getPurchaseHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ purchase: await purchaseService.getPurchase(strParam(req, 'id')) });
});

export const cancelPurchaseHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Cancelled by user';
  const purchase = await purchaseService.cancelPurchase(strParam(req, 'id'), reason, actor);
  res.json({ purchase });
});

// ---- Stock / inventory ----
export const listStockHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; medicineId?: string }>(req);
  res.json(await inventoryService.listStock(q));
});

export const expiryReportHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ withinDays: number; page: number; limit: number; expired: 'true' | 'false' }>(req);
  res.json(await inventoryService.expiryReport({ withinDays: q.withinDays, includeExpired: q.expired === 'true', page: q.page, limit: q.limit }));
});

export const adjustStockHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const result = await inventoryService.adjustStock(req.body as { batchId: string; quantityChange: number; reason: string }, actor);
  res.json(result);
});

export const listMovementsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{ page: number; limit: number; medicineId?: string }>(req);
  res.json(await inventoryService.listMovements(q));
});

// ---- Bills ----
export const createBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const bill = await billingService.createPharmacyBill(req.body as CreateBillInput, actor);
  res.status(201).json({ bill });
});

export const listBillsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = query<{
    page: number;
    limit: number;
    patientId?: string;
    billDate?: string;
  }>(req);
  res.json(await billingService.listBills(q));
});

export const getBillHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ bill: await billingService.getBill(strParam(req, 'id')) });
});

export const cancelBillHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length >= 3 ? req.body.reason : 'Bill cancelled by user';
  const bill = await billingService.cancelPharmacyBill(strParam(req, 'id'), reason, actor);
  res.json({ bill });
});

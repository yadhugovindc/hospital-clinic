import { Router } from 'express';
import { guard } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { idParams, medicineIdParams, movementQuerySchema, purchaseQuerySchema } from './validation-params.js';
import {
  adjustStockHandler,
  cancelBillHandler,
  cancelPurchaseHandler,
  createBillHandler,
  createMedicineHandler,
  createPurchaseHandler,
  createSupplierHandler,
  expiryReportHandler,
  getBillHandler,
  getMedicineHandler,
  getPurchaseHandler,
  listBillsHandler,
  listMedicinesHandler,
  listMovementsHandler,
  listPurchasesHandler,
  listStockHandler,
  listSuppliersHandler,
  medicineStockHandler,
  updateMedicineHandler,
  updateSupplierHandler,
} from './pharmacy.controller.js';
import {
  adjustStockSchema,
  billQuerySchema,
  createBillSchema,
  createMedicineSchema,
  createPurchaseSchema,
  createSupplierSchema,
  expiryQuerySchema,
  medicineQuerySchema,
  stockQuerySchema,
  updateMedicineSchema,
  updateSupplierSchema,
} from './pharmacy.validation.js';

export const pharmacyRouter = Router();

// Medicines
pharmacyRouter.get('/medicines', guard('pharmacy:read'), validate(medicineQuerySchema, 'query'), asyncHandler(listMedicinesHandler));
pharmacyRouter.get('/medicines/:id', guard('pharmacy:read'), validate(idParams, 'params'), asyncHandler(getMedicineHandler));
pharmacyRouter.get('/medicines/:id/stock', guard('pharmacy:read'), validate(medicineIdParams, 'params'), asyncHandler(medicineStockHandler));
pharmacyRouter.post('/medicines', guard('pharmacy:write'), validate(createMedicineSchema), asyncHandler(createMedicineHandler));
pharmacyRouter.patch('/medicines/:id', guard('pharmacy:write'), validate(idParams, 'params'), validate(updateMedicineSchema), asyncHandler(updateMedicineHandler));

// Suppliers
pharmacyRouter.get('/suppliers', guard('pharmacy:read'), asyncHandler(listSuppliersHandler));
pharmacyRouter.post('/suppliers', guard('pharmacy:write'), validate(createSupplierSchema), asyncHandler(createSupplierHandler));
pharmacyRouter.patch('/suppliers/:id', guard('pharmacy:write'), validate(idParams, 'params'), validate(updateSupplierSchema), asyncHandler(updateSupplierHandler));

// Purchases
pharmacyRouter.post('/purchases', guard('pharmacy:write'), validate(createPurchaseSchema), asyncHandler(createPurchaseHandler));
pharmacyRouter.get('/purchases', guard('pharmacy:read'), validate(purchaseQuerySchema, 'query'), asyncHandler(listPurchasesHandler));
pharmacyRouter.get('/purchases/:id', guard('pharmacy:read'), validate(idParams, 'params'), asyncHandler(getPurchaseHandler));
pharmacyRouter.post('/purchases/:id/cancel', guard('pharmacy:write'), validate(idParams, 'params'), asyncHandler(cancelPurchaseHandler));

// Stock
pharmacyRouter.get('/stock', guard('pharmacy:read'), validate(stockQuerySchema, 'query'), asyncHandler(listStockHandler));
pharmacyRouter.get('/stock/expiry', guard('pharmacy:read'), validate(expiryQuerySchema, 'query'), asyncHandler(expiryReportHandler));
pharmacyRouter.post('/stock/adjust', guard('pharmacy:write'), validate(adjustStockSchema), asyncHandler(adjustStockHandler));
pharmacyRouter.get('/stock/movements', guard('pharmacy:read'), validate(movementQuerySchema, 'query'), asyncHandler(listMovementsHandler));

// Bills
pharmacyRouter.post('/bills', guard('pharmacy:write'), validate(createBillSchema), asyncHandler(createBillHandler));
pharmacyRouter.get('/bills', guard('pharmacy:read'), validate(billQuerySchema, 'query'), asyncHandler(listBillsHandler));
pharmacyRouter.get('/bills/:id', guard('pharmacy:read'), validate(idParams, 'params'), asyncHandler(getBillHandler));
pharmacyRouter.post('/bills/:id/cancel', guard('pharmacy:write'), validate(idParams, 'params'), asyncHandler(cancelBillHandler));

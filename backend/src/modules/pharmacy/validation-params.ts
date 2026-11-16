import { z } from 'zod';
import { dateString, objectId, pageNumber, pageSize } from '../../shared/validation/schemas.js';

export const idParams = z.object({ id: objectId });

export const medicineIdParams = z.object({ id: objectId });

export const purchaseQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  supplierId: objectId.optional(),
  purchaseDate: dateString.optional(),
});

export const movementQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize,
  medicineId: objectId.optional(),
});

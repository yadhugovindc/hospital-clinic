import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { getSettings, updateSettings } from './clinic.service.js';
import type { UpdateSettingsInput } from './clinic.validation.js';

export const getSettingsHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ settings: await getSettings() });
});

export const updateSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const settings = await updateSettings(req.body as UpdateSettingsInput, actor.id, actor.email);
  res.json({ settings });
});

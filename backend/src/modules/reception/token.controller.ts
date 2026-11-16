import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getUser } from '../../shared/middleware/auth.js';
import { strParam } from '../../shared/utils/request-helpers.js';
import { updateTokenStatus } from './token.service.js';
import { bookToken, listQueueCounts, listTokens } from './token.service.js';
import type { BookTokenInput, TokenListInput, TokenStatusInput } from './reception.validation.js';

export const bookTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const token = await bookToken(req.body as BookTokenInput, actor.id, actor.email);
  res.status(201).json({ token });
});

export const listTokensHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as TokenListInput;
  res.json(await listTokens(q));
});

export const queueCountsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as { tokenDate?: string };
  res.json(await listQueueCounts(q.tokenDate));
});

export const updateTokenStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const actor = getUser(req);
  const { status } = req.body as TokenStatusInput;
  const token = await updateTokenStatus(strParam(req, 'id'), status, actor.id, actor.email);
  res.json({ token });
});

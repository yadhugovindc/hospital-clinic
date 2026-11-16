import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { validate } from '../../shared/middleware/validate.js';
import { authenticate } from '../../shared/middleware/auth.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { changePasswordHandler, loginHandler, logoutHandler, meHandler } from './auth.controller.js';
import { changePasswordSchema, loginSchema } from './auth.validation.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.IS_TEST, // tests authenticate dozens of times; production behavior unaffected
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), loginHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', authenticate, meHandler);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(changePasswordHandler));

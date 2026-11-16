import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { UnauthorizedError } from '../../shared/errors/api-error.js';
import { getUser, type AuthenticatedRequest } from '../../shared/middleware/auth.js';
import { changeOwnPassword, login, logout, setAuthCookie, toSafeUser } from './auth.service.js';
import { signAccessToken } from './token.service.js';
import type { LoginInput } from './auth.validation.js';

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const user = await login(email, password, req, res);
  res.json({ user });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  let userId: string | undefined;
  let email: string | undefined;
  try {
    const user = getUser(req);
    userId = user.id;
    email = user.email;
  } catch {
    // Logging out without a session is still successful.
  }
  logout(res, userId, email, req.ip);
  res.json({ message: 'Logged out' });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = (req as AuthenticatedRequest).user;
  if (!session) throw new UnauthorizedError();
  // Session payload is signed; still re-read the account so deactivation and
  // profile changes take effect immediately.
  const { User } = await import('../../database/models/user.model.js');
  const user = await User.findById(session.id);
  if (!user || !user.isActive) throw new UnauthorizedError('Session expired or account deactivated');
  setAuthCookie(res, signAccessToken({ sub: String(user._id), email: user.email, role: user.role, name: user.name }));
  res.json({ user: toSafeUser(user) });
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = getUser(req);
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await changeOwnPassword(session.id, currentPassword, newPassword);
  res.json({ message: 'Password updated' });
});

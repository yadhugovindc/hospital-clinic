import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { User, type UserDoc } from '../../database/models/user.model.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors/api-error.js';
import { recordAudit } from '../../database/models/audit-log.model.js';
import { env } from '../../config/env.js';
import { signAccessToken } from './token.service.js';

const ACCESS_COOKIE = 'clinic_access';

interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

function toSafeUser(user: UserDoc): SafeUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE_BOOL || env.IS_PROD,
    sameSite: 'lax',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
    path: '/api',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/api' });
}

export async function login(emailInput: string, passwordInput: string, req: Request, res: Response): Promise<SafeUser> {
  const email = emailInput.trim().toLowerCase();
  const user = await User.findOne({ email });
  // Constant work regardless of whether the account exists.
  const hash = user?.passwordHash ?? '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBLKUbNBLU7VWDxF6z1fMaQXiCXWf2';
  const ok = await bcrypt.compare(passwordInput, hash);
  if (!user || !ok) {
    throw new UnauthorizedError('Invalid email or password');
  }
  if (!user.isActive) {
    throw new ForbiddenError('Account is deactivated. Contact an administrator.');
  }

  const token = signAccessToken({ sub: String(user._id), email: user.email, role: user.role, name: user.name });
  setAuthCookie(res, token);

  recordAudit({
    actorId: user._id as never,
    actorEmail: user.email,
    action: 'auth.login',
    entityType: 'User',
    entityId: String(user._id),
    ip: req.ip,
  } as never);

  return toSafeUser(user);
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError('Session user no longer exists');
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');
  if (newPassword.length < 8) throw new UnauthorizedError('New password must be at least 8 characters');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  recordAudit({
    actorId: user._id as never,
    actorEmail: user.email,
    action: 'auth.password_change',
    entityType: 'User',
    entityId: String(user._id),
  } as never);
}

export function logout(res: Response, userId?: string, email?: string, ip?: string): void {
  clearAuthCookie(res);
  if (userId) {
    recordAudit({
      actorId: userId as never,
      actorEmail: email,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      ip,
    } as never);
  }
}

export { toSafeUser, ACCESS_COOKIE };

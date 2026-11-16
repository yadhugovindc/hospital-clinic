import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/api-error.js';
import { verifyAccessToken } from '../../modules/auth/token.service.js';
import { ACCESS_COOKIE } from '../../modules/auth/auth.service.js';
import { roleHasPermission, type Permission, type Role } from '../utils/rbac.js';

export interface AuthenticatedRequest extends Request {
  /** Populated by `authenticate` for every protected route. */
  user: { id: string; email: string; role: Role; name: string };
}

type AuthHandler = (req: Request, res: Response, next: NextFunction) => void;

export function getUser(req: Request): { id: string; email: string; role: Role; name: string } {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Verifies the HttpOnly access cookie and attaches the payload to `req.user`. */
export const authenticate: AuthHandler = (req, _res, next) => {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[ACCESS_COOKIE];
  if (!token) {
    next(new UnauthorizedError());
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    next();
  } catch {
    next(new UnauthorizedError('Session expired or invalid'));
  }
};

/** Factory for permission checks bound to specific endpoints. */
export function requires(permission: Permission): AuthHandler {
  return (req, _res, next) => {
    const user = getUser(req);
    if (!roleHasPermission(user.role, permission)) {
      next(new ForbiddenError(`Your role (${user.role}) does not have permission for this operation`));
      return;
    }
    next();
  };
}

/** Combined authentication + permission check in one middleware factory. */
export function guard(permission: Permission): AuthHandler[] {
  return [authenticate, requires(permission)];
}

/** Admin-only guard. */
export const requireAdmin: AuthHandler = (req, _res, next) => {
  const user = getUser(req);
  if (user.role !== 'admin') {
    next(new ForbiddenError('Admin role required'));
    return;
  }
  next();
};

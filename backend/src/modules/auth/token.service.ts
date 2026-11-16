import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { Role } from '../../shared/utils/rbac.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    issuer: 'ayurvedic-clinic',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'ayurvedic-clinic' }) as AccessTokenPayload;
}

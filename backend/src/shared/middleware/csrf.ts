import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { ForbiddenError } from "../errors/api-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense-in-depth for cookie-based auth.
 *
 * The access token lives in an HttpOnly cookie with SameSite=Lax, which already
 * blocks most cross-site request attaching. As an additional layer, every
 * state-changing request must carry a same-origin `Origin`/`Referer` that is
 * explicitly allow-listed; agents that cannot send these headers (tests, curl)
 * can omit them.
 */
export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const originHeader = (req.headers.origin as string | undefined) ?? undefined;
  const refererHeader = req.headers.referer as string | undefined;

  // No origin headers at all (non-browser client): allow.
  if (!originHeader && !refererHeader) {
    next();
    return;
  }

  const allowed = new Set([
    ...env.FRONTEND_URLS,
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
    `${req.protocol}://${req.get("host") ?? ""}`,
  ]);

  const source = originHeader ?? refererHeader;
  if (source === undefined) {
    next();
    return;
  }

  try {
    const parsed = new URL(source);
    if (!allowed.has(parsed.origin)) {
      next(new ForbiddenError("Cross-site request blocked (CSRF protection)"));
      return;
    }
    next();
  } catch {
    next(new ForbiddenError("Malformed origin header (CSRF protection)"));
  }
}

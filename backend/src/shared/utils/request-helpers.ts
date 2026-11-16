import type { Request } from 'express';

/** Safe string accessor for route params (Express 5 types allow string[]). */
export function strParam(req: Request, key: string): string {
  const value = req.params[key];
  return typeof value === 'string' ? value : '';
}

/** Casts the parsed query string to the validated schema type (validation middleware ran before the handler). */
export function query<T>(req: Request): T {
  return req.query as unknown as T;
}

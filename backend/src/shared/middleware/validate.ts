import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Parses and replaces the matching request location with validated data.
 * Data missing required keys never reaches handlers.
 */
export function validate<S extends ZodType>(schema: S, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}

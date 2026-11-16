import { NextFunction, Request, Response } from 'express';

/**
 * Async error handler that forwards rejected promises to the error middleware.
 * Express 5 supports returned rejected promises natively; this wrapper is kept
 * for readability and explicitness of the error flow.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(handler(req as Req, res, next)).catch(next);
  };
}

import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { logger } from '../logging/logger.js';
import { ApiError } from './api-error.js';

function zodDetails(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_root';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Central error handler. Never leaks stack traces or internal errors to
 * clients in production; logs the full details server-side instead.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: zodDetails(err) },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [path, e] of Object.entries(err.errors)) {
      details[path] = e instanceof Error ? e.message : 'Invalid value';
    }
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid identifier format' } });
    return;
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with this unique value already exists' } });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Permission denied', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

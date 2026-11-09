import { type ApiErrorBody, ERROR_CODES } from '@next-stride/shared';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { logger } from '../lib/logger';
import { AppError, Errors } from '../utils/errors';

function normalise(error: unknown): AppError | null {
  if (error instanceof AppError) return error;

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return Errors.payloadTooLarge('Profile pictures must be 5 MB or smaller');
    return Errors.validation({ [error.field ?? 'file']: [error.message] }, 'Invalid upload');
  }

  // body-parser errors carry a `type` and an HTTP status.
  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === 'entity.parse.failed') {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request body is not valid JSON');
  }
  if (bodyError.type === 'entity.too.large') return Errors.payloadTooLarge();

  return null;
}

/** Centralised error handler: every error leaves the API in the same JSON shape. */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const known = normalise(error);
  const requestId = String(req.id ?? '');

  if (known) {
    const body: ApiErrorBody = {
      error: {
        code: known.code,
        message: known.message,
        ...(known.fields ? { fields: known.fields } : {}),
        ...(known.details ? { details: known.details } : {}),
        requestId,
      },
    };
    res.status(known.status).json(body);
    return;
  }

  logger.error({ err: error, requestId }, 'Unhandled error');
  const body: ApiErrorBody = {
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Something went wrong. Please try again.', requestId },
  };
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: ERROR_CODES.NOT_FOUND, message: `Route ${req.method} ${req.path} not found` },
  };
  res.status(404).json(body);
}

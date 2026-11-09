import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

import { Errors } from '../utils/errors';

/** Flattens Zod issues into `{ "field.path": ["message", ...] }`. */
export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Parses `req.query` (read-only in Express 5) and returns the typed result.
 */
export function parseQuery<S extends z.ZodType>(schema: S, req: Request): z.infer<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) throw Errors.validation(zodFieldErrors(result.error));
  return result.data;
}

/**
 * Validates and replaces `req.body` / `req.params` with the parsed (normalised) values.
 * Unknown keys are stripped unless the schema is strict.
 */
export function validate(schemas: { body?: z.ZodType; params?: z.ZodType }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body ?? {});
      if (!result.success) throw Errors.validation(zodFieldErrors(result.error));
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) throw Errors.validation(zodFieldErrors(result.error));
      req.params = result.data as Request['params'];
    }
    next();
  };
}

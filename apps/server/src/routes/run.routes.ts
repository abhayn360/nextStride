import { appendRunPointsSchema, completeRunSchema, createRunSchema } from '@next-stride/shared';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { z } from 'zod';

import { runController } from '../controllers/run.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { Errors } from '../utils/errors';

/** Malformed ids are reported as "not found" — never reveal anything about ids. */
function requireUuidParam(req: Request, _res: Response, next: NextFunction) {
  if (!z.uuid().safeParse(req.params.id).success) throw Errors.notFound('Run not found');
  next();
}

export function runRoutes(): Router {
  const router = Router();

  // Point batches (up to 1000 fixes) are larger than the API-wide 20 KB JSON limit.
  router.use(express.json({ limit: '512kb' }));
  router.use(authenticate);

  router.post('/', validate({ body: createRunSchema }), runController.create);
  router.get('/', runController.list);
  // Static paths before `/:id`.
  router.get('/stats', runController.stats);
  router.get('/:id', requireUuidParam, runController.detail);
  router.delete('/:id', requireUuidParam, runController.remove);
  router.post('/:id/points', requireUuidParam, validate({ body: appendRunPointsSchema }), runController.appendPoints);
  router.post('/:id/complete', requireUuidParam, validate({ body: completeRunSchema }), runController.complete);

  return router;
}

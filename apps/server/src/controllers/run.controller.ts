import {
  type AppendRunPointsInput,
  type CompleteRunInput,
  type CreateRunInput,
  listRunsQuerySchema,
  runStatsQuerySchema,
} from '@next-stride/shared';
import type { Request, Response } from 'express';

import { toRunSummary } from '../mappers/run.mapper';
import { requireUserId } from '../middleware/authenticate';
import { parseQuery } from '../middleware/validate';
import { userRepository } from '../repositories/user.repository';
import { getRunProgress } from '../services/run-progress.service';
import { getRunStats } from '../services/run-stats.service';
import { runService } from '../services/run.service';

type IdParams = { id: string };

export const runController = {
  async create(req: Request<Record<string, string>, unknown, CreateRunInput>, res: Response) {
    const { run, created } = await runService.create(requireUserId(req), req.body);
    res.status(created ? 201 : 200).json(toRunSummary(run));
  },

  async appendPoints(req: Request<IdParams, unknown, AppendRunPointsInput>, res: Response) {
    res.json(await runService.appendPoints(requireUserId(req), req.params.id, req.body));
  },

  async complete(req: Request<IdParams, unknown, CompleteRunInput>, res: Response) {
    const userId = requireUserId(req);
    const user = await userRepository.findById(userId);
    const weightKg = user?.profile?.weightKg != null ? Number(user.profile.weightKg) : null;
    const run = await runService.complete(userId, req.params.id, req.body, weightKg);
    res.json(toRunSummary(run));
  },

  async list(req: Request, res: Response) {
    const query = parseQuery(listRunsQuerySchema, req);
    res.json(await runService.list(requireUserId(req), query.limit, query.cursor));
  },

  async stats(req: Request, res: Response) {
    const query = parseQuery(runStatsQuerySchema, req);
    res.json(await getRunStats(requireUserId(req), query.tz));
  },

  async progress(req: Request, res: Response) {
    const query = parseQuery(runStatsQuerySchema, req);
    res.json(await getRunProgress(requireUserId(req), query.tz));
  },

  async detail(req: Request<IdParams>, res: Response) {
    res.json(await runService.detail(requireUserId(req), req.params.id));
  },

  async remove(req: Request<IdParams>, res: Response) {
    await runService.remove(requireUserId(req), req.params.id);
    res.status(204).end();
  },
};

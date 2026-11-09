import type { Prisma } from '../generated/prisma/client';
import { type DbClient, prisma } from '../lib/prisma';

export interface RunCursor {
  startedAt: Date;
  id: string;
}

/**
 * Every query is scoped by `userId`: a run that belongs to someone else is
 * indistinguishable from one that doesn't exist.
 */
export const runRepository = {
  findOwned(userId: string, id: string, db: DbClient = prisma) {
    return db.run.findFirst({ where: { id, userId } });
  },

  findByClientId(userId: string, clientId: string, db: DbClient = prisma) {
    return db.run.findUnique({ where: { userId_clientId: { userId, clientId } } });
  },

  create(data: { userId: string; clientId: string; startedAt: Date }, db: DbClient = prisma) {
    return db.run.create({ data });
  },

  /** Inserts points, silently skipping any already stored for the same timestamp. Returns rows inserted. */
  async insertPoints(runId: string, points: Omit<Prisma.RunPointCreateManyInput, 'runId'>[], db: DbClient = prisma): Promise<number> {
    const result = await db.runPoint.createMany({
      data: points.map((point) => ({ ...point, runId })),
      skipDuplicates: true,
    });
    return result.count;
  },

  countPoints(runId: string, db: DbClient = prisma) {
    return db.runPoint.count({ where: { runId } });
  },

  setPointCount(runId: string, pointCount: number, db: DbClient = prisma) {
    return db.run.update({ where: { id: runId }, data: { pointCount } });
  },

  listPoints(runId: string, db: DbClient = prisma) {
    return db.runPoint.findMany({
      where: { runId },
      orderBy: { recordedAt: 'asc' },
      select: { latitude: true, longitude: true, altitude: true, accuracy: true, recordedAt: true, segment: true },
    });
  },

  /** Completes only if still in progress; returns false when another request already did. */
  async markCompleted(id: string, data: Prisma.RunUpdateManyMutationInput, db: DbClient = prisma): Promise<boolean> {
    const result = await db.run.updateMany({
      where: { id, status: 'IN_PROGRESS' },
      data: { ...data, status: 'COMPLETED' },
    });
    return result.count === 1;
  },

  /** Newest first, keyset-paginated on (startedAt, id) so pages stay stable as runs are added. */
  listCompleted(userId: string, limit: number, cursor: RunCursor | null, db: DbClient = prisma) {
    return db.run.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        ...(cursor
          ? {
              OR: [{ startedAt: { lt: cursor.startedAt } }, { startedAt: cursor.startedAt, id: { lt: cursor.id } }],
            }
          : {}),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
  },

  async deleteOwned(userId: string, id: string, db: DbClient = prisma): Promise<boolean> {
    const result = await db.run.deleteMany({ where: { id, userId } });
    return result.count === 1;
  },
};

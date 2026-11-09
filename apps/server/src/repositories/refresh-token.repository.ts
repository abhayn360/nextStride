import { type DbClient, prisma } from '../lib/prisma';

export const refreshTokenRepository = {
  create(
    data: {
      userId: string;
      tokenHash: string;
      familyId: string;
      expiresAt: Date;
      userAgent?: string | null;
      ipAddress?: string | null;
    },
    db: DbClient = prisma,
  ) {
    return db.refreshToken.create({ data });
  },

  findByHash(tokenHash: string, db: DbClient = prisma) {
    return db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, tokenVersion: true } } },
    });
  },

  /**
   * Revoke a single active token. Returns false if it was already revoked —
   * which, during rotation, means another request won the race.
   */
  async revokeIfActive(id: string, db: DbClient = prisma): Promise<boolean> {
    const result = await db.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  },

  linkReplacement(id: string, replacedById: string, db: DbClient = prisma) {
    return db.refreshToken.update({ where: { id }, data: { replacedById } });
  },

  revokeFamily(familyId: string, db: DbClient = prisma) {
    return db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string, db: DbClient = prisma) {
    return db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  /** Housekeeping: drop tokens that expired more than `graceDays` ago. */
  deleteExpired(graceDays = 7, db: DbClient = prisma) {
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    return db.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  },
};

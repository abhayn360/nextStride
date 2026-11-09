import { type DbClient, prisma } from '../lib/prisma';

export const passwordResetTokenRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }, db: DbClient = prisma) {
    return db.passwordResetToken.create({ data });
  },

  findByHash(tokenHash: string, db: DbClient = prisma) {
    return db.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  /** Marks the token used; returns false if it was already used (single-use guarantee). */
  async consume(id: string, db: DbClient = prisma): Promise<boolean> {
    const result = await db.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  },

  /** A new request supersedes any earlier, still-unused links. */
  invalidateOutstanding(userId: string, db: DbClient = prisma) {
    return db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },

  deleteExpired(db: DbClient = prisma) {
    return db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },
};

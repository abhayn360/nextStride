import type { Prisma } from '../generated/prisma/client';
import { type DbClient, prisma } from '../lib/prisma';

export const userWithProfile = { profile: true } satisfies Prisma.UserInclude;
export type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userWithProfile }>;

export const userRepository = {
  findById(id: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { id }, include: userWithProfile });
  },

  findByEmail(email: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { email }, include: userWithProfile });
  },

  findByUsername(username: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { username }, include: userWithProfile });
  },

  /** Minimal lookup used on every authenticated request. */
  findAuthState(id: string, db: DbClient = prisma) {
    return db.user.findUnique({ where: { id }, select: { id: true, tokenVersion: true } });
  },

  async emailExists(email: string, excludeUserId?: string, db: DbClient = prisma) {
    const found = await db.user.findUnique({ where: { email }, select: { id: true } });
    return found !== null && found.id !== excludeUserId;
  },

  async usernameExists(username: string, excludeUserId?: string, db: DbClient = prisma) {
    const found = await db.user.findUnique({ where: { username }, select: { id: true } });
    return found !== null && found.id !== excludeUserId;
  },

  create(
    data: { email: string; username: string; passwordHash: string; fullName: string },
    db: DbClient = prisma,
  ) {
    return db.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        profile: { create: { fullName: data.fullName } },
      },
      include: userWithProfile,
    });
  },

  update(
    id: string,
    data: { user?: Prisma.UserUpdateInput; profile?: Prisma.UserProfileUpdateWithoutUserInput },
    db: DbClient = prisma,
  ) {
    return db.user.update({
      where: { id },
      data: {
        ...data.user,
        ...(data.profile && Object.keys(data.profile).length > 0 ? { profile: { update: data.profile } } : {}),
      },
      include: userWithProfile,
    });
  },

  recordLogin(id: string, passwordHash?: string, db: DbClient = prisma) {
    return db.user.update({
      where: { id },
      data: { lastLoginAt: new Date(), ...(passwordHash ? { passwordHash } : {}) },
      select: { id: true },
    });
  },

  /** Sets a new password and invalidates every outstanding access token. */
  setPassword(id: string, passwordHash: string, db: DbClient = prisma) {
    return db.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    });
  },
};

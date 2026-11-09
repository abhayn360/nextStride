import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../config/env';
import { type Prisma, PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Either the root client or an interactive transaction client — repositories accept both. */
export type DbClient = Prisma.TransactionClient;

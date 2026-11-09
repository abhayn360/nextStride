import { afterAll, beforeEach } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { setMailTransport } from '../src/services/mail.service';
import { mailbox } from './helpers';

setMailTransport(mailbox);

beforeEach(async () => {
  mailbox.outbox.length = 0;
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE run_points, runs, password_reset_tokens, refresh_tokens, user_profiles, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

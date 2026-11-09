import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, eventually, mailbox, registerUser } from './helpers';

function tokenFromMail(): string {
  const message = mailbox.outbox.at(-1);
  const match = message?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error('No reset link in mail');
  return decodeURIComponent(match[1]);
}

describe('POST /api/auth/forgot-password', () => {
  it('responds identically whether or not the email exists', async () => {
    await registerUser({ email: 'real@example.com' });
    const known = await api.post('/api/auth/forgot-password').send({ email: 'real@example.com' }).expect(202);
    const unknown = await api.post('/api/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(202);
    expect(unknown.body).toEqual(known.body);

    await eventually(() => (mailbox.outbox.length > 0 ? true : undefined));
    expect(mailbox.outbox).toHaveLength(1);
    expect(mailbox.outbox[0]?.to).toBe('real@example.com');
  });

  it('stores only a hash of the reset token', async () => {
    await registerUser({ email: 'hash@example.com' });
    await api.post('/api/auth/forgot-password').send({ email: 'hash@example.com' }).expect(202);
    await eventually(() => mailbox.outbox[0]);
    const token = tokenFromMail();
    const rows = await prisma.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });
});

describe('POST /api/auth/reset-password', () => {
  async function requestReset(email: string) {
    await api.post('/api/auth/forgot-password').send({ email }).expect(202);
    const before = mailbox.outbox.length;
    await eventually(() => (mailbox.outbox.length >= Math.max(before, 1) ? true : undefined));
    return tokenFromMail();
  }

  it('sets a new password and signs out every session', async () => {
    const { input, tokens, auth } = await registerUser();
    const token = await requestReset(input.email);

    await api.post('/api/auth/reset-password').send({ token, password: 'newStride456' }).expect(200);

    await api.post('/api/auth/login').send({ email: input.email, password: input.password }).expect(401);
    await api.post('/api/auth/login').send({ email: input.email, password: 'newStride456' }).expect(200);
    await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    // Access tokens issued before the reset stop working immediately.
    await api.get('/api/users/me').set(auth).expect(401);
  });

  it('is single-use', async () => {
    const { input } = await registerUser();
    const token = await requestReset(input.email);
    await api.post('/api/auth/reset-password').send({ token, password: 'newStride456' }).expect(200);
    const again = await api.post('/api/auth/reset-password').send({ token, password: 'other789xyz' }).expect(400);
    expect(again.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired tokens', async () => {
    const { input } = await registerUser();
    const token = await requestReset(input.email);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await api.post('/api/auth/reset-password').send({ token, password: 'newStride456' }).expect(400);
  });

  it('invalidates older links when a new one is requested', async () => {
    const { input } = await registerUser();
    const first = await requestReset(input.email);
    mailbox.outbox.length = 0;
    const second = await requestReset(input.email);
    expect(second).not.toBe(first);
    await api.post('/api/auth/reset-password').send({ token: first, password: 'newStride456' }).expect(400);
    await api.post('/api/auth/reset-password').send({ token: second, password: 'newStride456' }).expect(200);
  });

  it('enforces password strength', async () => {
    const { input } = await registerUser();
    const token = await requestReset(input.email);
    const res = await api.post('/api/auth/reset-password').send({ token, password: 'weak' }).expect(400);
    expect(res.body.error.fields.password).toBeDefined();
  });
});

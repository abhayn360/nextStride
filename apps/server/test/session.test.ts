import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/utils/crypto';
import { api, registerUser } from './helpers';

const secret = process.env.JWT_ACCESS_SECRET as string;

describe('POST /api/auth/refresh (token rotation)', () => {
  it('issues a new token pair and returns the current user', async () => {
    const { tokens, user } = await registerUser();
    const res = await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200);

    expect(res.body.user.id).toBe(user.id);
    expect(res.body.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('stores refresh tokens hashed, never in plain text', async () => {
    const { tokens } = await registerUser();
    const rows = await prisma.refreshToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashToken(tokens.refreshToken));
    expect(JSON.stringify(rows)).not.toContain(tokens.refreshToken);
  });

  it('detects reuse of a rotated token and revokes the whole session family', async () => {
    const { tokens } = await registerUser();
    const rotated = (await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200)).body
      .tokens;

    // An attacker replays the old token…
    const replay = await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // …so the legitimate, newer token is revoked as well.
    const legit = await api.post('/api/auth/refresh').send({ refreshToken: rotated.refreshToken }).expect(401);
    expect(legit.body.error.code).toBe('INVALID_TOKEN');
  });

  it('lets exactly one of two concurrent refreshes with the same token win', async () => {
    const { tokens } = await registerUser();
    const results = await Promise.all([
      api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }),
      api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('rejects an expired refresh token as an expired session', async () => {
    const { tokens } = await registerUser();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects an unknown refresh token', async () => {
    const res = await api.post('/api/auth/refresh').send({ refreshToken: 'made-up' }).expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('session restoration', () => {
  it('restores a session after an app restart using only the stored refresh token', async () => {
    const { tokens, user } = await registerUser();

    // App restarts: in-memory access token is gone; only the securely stored refresh token survives.
    const restored = await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200);
    const me = await api
      .get('/api/users/me')
      .set('Authorization', `Bearer ${restored.body.tokens.accessToken}`)
      .expect(200);
    expect(me.body.id).toBe(user.id);

    // A second restart later on works with the rotated token.
    await api.post('/api/auth/refresh').send({ refreshToken: restored.body.tokens.refreshToken }).expect(200);
  });
});

describe('protected endpoints', () => {
  it('require an access token', async () => {
    const res = await api.get('/api/users/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    await api.put('/api/users/me').send({ bio: 'hi' }).expect(401);
    await api.get('/api/users/someone').expect(401);
  });

  it('reject malformed authorization headers', async () => {
    await api.get('/api/users/me').set('Authorization', 'Token abc').expect(401);
    await api.get('/api/users/me').set('Authorization', 'Bearer').expect(401);
  });

  it('reject a tampered access token', async () => {
    const { tokens } = await registerUser();
    const [header, payload] = tokens.accessToken.split('.');
    const forged = `${header}.${payload}.${'A'.repeat(43)}`;
    const res = await api.get('/api/users/me').set('Authorization', `Bearer ${forged}`).expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('reject a token signed with another secret or algorithm', async () => {
    const { user } = await registerUser();
    const wrongSecret = jwt.sign({ ver: 0, typ: 'access' }, 'x'.repeat(40), {
      subject: user.id,
      issuer: 'next-stride-api',
      audience: 'next-stride-app',
    });
    await api.get('/api/users/me').set('Authorization', `Bearer ${wrongSecret}`).expect(401);

    const unsigned = jwt.sign({ ver: 0, typ: 'access', sub: user.id }, '', { algorithm: 'none' });
    await api.get('/api/users/me').set('Authorization', `Bearer ${unsigned}`).expect(401);
  });

  it('report an expired access token distinctly so clients know to refresh', async () => {
    const { user } = await registerUser();
    const expired = jwt.sign({ ver: 0, typ: 'access' }, secret, {
      subject: user.id,
      issuer: 'next-stride-api',
      audience: 'next-stride-app',
      expiresIn: -10,
    });
    const res = await api.get('/api/users/me').set('Authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('reject access tokens for deleted accounts', async () => {
    const { auth, user } = await registerUser();
    await prisma.user.delete({ where: { id: user.id } });
    await api.get('/api/users/me').set(auth).expect(401);
  });
});

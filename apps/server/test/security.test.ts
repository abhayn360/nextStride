import { describe, expect, it } from 'vitest';

import { api, makeApi, registerUser } from './helpers';

describe('rate limiting', () => {
  it('throttles repeated credential attempts', async () => {
    const limited = makeApi({ rateLimit: { max: 3, windowMinutes: 1 } });
    const attempt = () => limited.post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever1' });

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers.ratelimit).toBeDefined();
  });

  it('gives token refresh a separate, larger budget', async () => {
    const limited = makeApi({ rateLimit: { max: 1, windowMinutes: 1 } });
    await limited.post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever1' }).expect(401);
    await limited.post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever1' }).expect(429);
    await limited.post('/api/auth/refresh').send({ refreshToken: 'x' }).expect(401);
  });
});

describe('CORS', () => {
  it('allows configured origins', async () => {
    const res = await api.options('/api/auth/login').set('Origin', 'http://localhost:8081').expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8081');
  });

  it('does not grant access to other origins', async () => {
    const res = await api.options('/api/auth/login').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves native clients that send no Origin header', async () => {
    await api.get('/health').expect(200);
  });
});

describe('hardening', () => {
  it('sets security headers and hides the framework', async () => {
    const res = await api.get('/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns JSON 404s for unknown routes', async () => {
    const res = await api.get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects oversized JSON bodies', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(30_000) });
    expect(res.status).toBe(413);
  });

  it('never exposes credentials in any user payload', async () => {
    const { auth, user } = await registerUser({ username: 'safe_user' });
    const responses = await Promise.all([
      api.get('/api/users/me').set(auth),
      api.get('/api/users/safe_user').set(auth),
      api.put('/api/users/me').set(auth).send({ bio: 'hi' }),
    ]);
    for (const res of responses) {
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|tokenVersion|\$argon2/);
    }
    expect(user).not.toHaveProperty('passwordHash');
  });
});

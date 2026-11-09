import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, registerUser, userInput } from './helpers';

describe('POST /api/auth/register', () => {
  it('creates an account and returns the user with a token pair', async () => {
    const input = userInput({ email: '  Ada@Example.COM ', username: 'Ada_Runs' });
    const res = await api.post('/api/auth/register').send(input).expect(201);

    expect(res.body.user).toMatchObject({
      email: 'ada@example.com',
      username: 'ada_runs',
      profile: { fullName: 'Ada Runner', isComplete: false, fitnessGoals: [] },
    });
    expect(res.body.tokens).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|stride123|tokenVersion/);
  });

  it('never stores the plain-text password', async () => {
    const { input } = await registerUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(row.passwordHash).not.toContain(input.password);
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('makes optional personal information private by default', async () => {
    const { user } = await registerUser();
    expect(user.profile.privacy).toEqual({ showAge: false, showBodyMetrics: false, showGender: false });
  });

  it('rejects a duplicate email, case-insensitively', async () => {
    await registerUser({ email: 'taken@example.com' });
    const res = await api
      .post('/api/auth/register')
      .send(userInput({ email: 'TAKEN@example.com' }))
      .expect(409);
    expect(res.body.error).toMatchObject({ code: 'EMAIL_TAKEN', fields: { email: [expect.any(String)] } });
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a duplicate username', async () => {
    await registerUser({ username: 'kipchoge' });
    const res = await api
      .post('/api/auth/register')
      .send(userInput({ username: 'KIPCHOGE' }))
      .expect(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('handles simultaneous signups with the same email', async () => {
    const input = userInput({ email: 'race@example.com' });
    const results = await Promise.all([
      api.post('/api/auth/register').send(input),
      api.post('/api/auth/register').send({ ...input, username: 'other_name' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('validates every field and reports errors per field', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ fullName: '', username: 'me', email: 'nope', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'fullName', 'password', 'username']);
  });

  it('rejects malformed JSON with a clean 400', async () => {
    const res = await api
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with valid credentials', async () => {
    const { input } = await registerUser();
    const res = await api
      .post('/api/auth/login')
      .send({ email: input.email.toUpperCase(), password: input.password })
      .expect(200);

    expect(res.body.user.email).toBe(input.email);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));

    const row = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(row.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects a wrong password', async () => {
    const { input } = await registerUser();
    const res = await api.post('/api/auth/login').send({ email: input.email, password: 'wrong-pass1' }).expect(401);
    expect(res.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  });

  it('gives the same answer for an unknown email (no account enumeration)', async () => {
    const { input } = await registerUser();
    const wrongPassword = await api.post('/api/auth/login').send({ email: input.email, password: 'wrong-pass1' });
    const unknownEmail = await api.post('/api/auth/login').send({ email: 'ghost@example.com', password: 'wrong-pass1' });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('requires both fields', async () => {
    const res = await api.post('/api/auth/login').send({}).expect(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'password']);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session so its refresh token no longer works', async () => {
    const { tokens } = await registerUser();
    await api.post('/api/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(204);

    const res = await api.post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('is idempotent and does not reveal whether a token existed', async () => {
    await api.post('/api/auth/logout').send({ refreshToken: 'not-a-real-token' }).expect(204);
    const { tokens } = await registerUser();
    await api.post('/api/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(204);
    await api.post('/api/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(204);
  });

  it('only ends the current device session', async () => {
    const { input, tokens: phone } = await registerUser();
    const tablet = (await api.post('/api/auth/login').send(input).expect(200)).body.tokens;

    await api.post('/api/auth/logout').send({ refreshToken: phone.refreshToken }).expect(204);
    await api.post('/api/auth/refresh').send({ refreshToken: tablet.refreshToken }).expect(200);
  });
});

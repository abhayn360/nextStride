import { describe, expect, it } from 'vitest';

import { prisma } from '../src/lib/prisma';
import { api, completeProfile, registerUser } from './helpers';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('GET /api/users/me', () => {
  it("returns the signed-in user's own profile", async () => {
    const { auth, user } = await registerUser();
    const res = await api.get('/api/users/me').set(auth).expect(200);
    expect(res.body).toEqual(user);
  });
});

describe('PUT /api/users/me', () => {
  it('completes the profile setup step', async () => {
    const { auth, user } = await registerUser();
    const res = await api
      .put('/api/users/me')
      .set(auth)
      .send({ ...completeProfile, heightCm: 172.5, weightKg: 64, gender: 'FEMALE', bio: 'Chasing a sub-90 half.' })
      .expect(200);

    expect(res.body.profile).toMatchObject({
      ...completeProfile,
      heightCm: 172.5,
      weightKg: 64,
      gender: 'FEMALE',
      bio: 'Chasing a sub-90 half.',
      isComplete: true,
    });
    const row = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it('only changes the fields provided and lets optional fields be cleared', async () => {
    const { auth } = await registerUser();
    await api.put('/api/users/me').set(auth).send({ ...completeProfile, heightCm: 180, bio: 'Hello' }).expect(200);

    const res = await api.put('/api/users/me').set(auth).send({ heightCm: null, fullName: 'Ada L.' }).expect(200);
    expect(res.body.profile).toMatchObject({ ...completeProfile, heightCm: null, bio: 'Hello', fullName: 'Ada L.' });
  });

  it('updates privacy settings independently', async () => {
    const { auth } = await registerUser();
    const res = await api.put('/api/users/me').set(auth).send({ privacy: { showAge: true } }).expect(200);
    expect(res.body.profile.privacy).toEqual({ showAge: true, showBodyMetrics: false, showGender: false });
  });

  it('rejects unknown or protected fields', async () => {
    const { auth } = await registerUser();
    const res = await api.put('/api/users/me').set(auth).send({ passwordHash: 'x', id: 'y' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates values', async () => {
    const { auth } = await registerUser();
    const res = await api
      .put('/api/users/me')
      .set(auth)
      .send({ heightCm: 5, runningExperience: 'LEGEND', dateOfBirth: '2030-01-01', bio: 'x'.repeat(281) })
      .expect(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['bio', 'dateOfBirth', 'heightCm', 'runningExperience']);
  });

  it('changes username and rejects taken ones', async () => {
    await registerUser({ username: 'taken_name' });
    const { auth } = await registerUser();

    const conflict = await api.put('/api/users/me').set(auth).send({ username: 'Taken_Name' }).expect(409);
    expect(conflict.body.error.code).toBe('USERNAME_TAKEN');

    const ok = await api.put('/api/users/me').set(auth).send({ username: 'Fresh_Name' }).expect(200);
    expect(ok.body.username).toBe('fresh_name');
  });

  it('requires the current password to change email', async () => {
    const { auth, input } = await registerUser();

    const missing = await api.put('/api/users/me').set(auth).send({ email: 'new@example.com' }).expect(400);
    expect(missing.body.error.fields.currentPassword).toBeDefined();

    const wrong = await api
      .put('/api/users/me')
      .set(auth)
      .send({ email: 'new@example.com', currentPassword: 'nope12345' })
      .expect(400);
    expect(wrong.body.error.fields.currentPassword).toEqual(['Current password is incorrect']);

    const ok = await api
      .put('/api/users/me')
      .set(auth)
      .send({ email: 'NEW@example.com', currentPassword: input.password })
      .expect(200);
    expect(ok.body.email).toBe('new@example.com');
    await api.post('/api/auth/login').send({ email: 'new@example.com', password: input.password }).expect(200);
  });

  it('rejects an email that belongs to someone else', async () => {
    await registerUser({ email: 'other@example.com' });
    const { auth, input } = await registerUser();
    const res = await api
      .put('/api/users/me')
      .set(auth)
      .send({ email: 'other@example.com', currentPassword: input.password })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('cannot be used to modify another user', async () => {
    const victim = await registerUser({ username: 'victim' });
    const attacker = await registerUser();
    // There is no route that targets another user's profile for writes.
    await api.put('/api/users/victim').set(attacker.auth).send({ bio: 'pwned' }).expect(404);
    const res = await api.get('/api/users/me').set(victim.auth).expect(200);
    expect(res.body.profile.bio).toBeNull();
  });
});

describe('GET /api/users/:username', () => {
  it('returns a public profile without private details', async () => {
    const owner = await registerUser({ username: 'paula' });
    await api
      .put('/api/users/me')
      .set(owner.auth)
      .send({ ...completeProfile, heightCm: 168, weightKg: 55, gender: 'FEMALE', bio: 'Marathoner' })
      .expect(200);
    const viewer = await registerUser();

    const res = await api.get('/api/users/Paula').set(viewer.auth).expect(200);
    expect(res.body).toEqual({
      username: 'paula',
      fullName: 'Ada Runner',
      avatarUrl: null,
      bio: 'Marathoner',
      runningExperience: 'INTERMEDIATE',
      preferredDistance: 'HALF_MARATHON',
      fitnessGoals: ['GET_FASTER', 'TRAIN_FOR_RACE'],
      memberSince: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/email|dateOfBirth|example\.com/);
  });

  it('reveals optional details only when the owner opts in', async () => {
    const owner = await registerUser({ username: 'eliud' });
    await api
      .put('/api/users/me')
      .set(owner.auth)
      .send({
        ...completeProfile,
        heightCm: 167,
        weightKg: 52,
        gender: 'MALE',
        privacy: { showAge: true, showBodyMetrics: true, showGender: true },
      })
      .expect(200);
    const viewer = await registerUser();

    const res = await api.get('/api/users/eliud').set(viewer.auth).expect(200);
    expect(res.body).toMatchObject({ age: expect.any(Number), heightCm: 167, weightKg: 52, gender: 'MALE' });
    expect(res.body.dateOfBirth).toBeUndefined();
  });

  it('404s for an unknown username', async () => {
    const { auth } = await registerUser();
    const res = await api.get('/api/users/nobody_here').set(auth).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('profile picture', () => {
  it('uploads, replaces and removes an avatar', async () => {
    const { auth } = await registerUser();

    const first = await api.post('/api/users/me/avatar').set(auth).attach('avatar', PNG_1X1, 'me.png').expect(200);
    expect(first.body.profile.avatarUrl).toMatch(/^http:\/\/api\.test\/uploads\/avatars\/.+\.png$/);

    const path = new URL(first.body.profile.avatarUrl).pathname;
    await api.get(path).expect(200).expect('Content-Type', /image\/png/);

    const second = await api.post('/api/users/me/avatar').set(auth).attach('avatar', PNG_1X1, 'new.png').expect(200);
    expect(second.body.profile.avatarUrl).not.toBe(first.body.profile.avatarUrl);
    await api.get(path).expect(404); // old file cleaned up

    const removed = await api.delete('/api/users/me/avatar').set(auth).expect(200);
    expect(removed.body.profile.avatarUrl).toBeNull();
  });

  it('rejects files that are not images, whatever their declared type', async () => {
    const { auth } = await registerUser();
    const res = await api
      .post('/api/users/me/avatar')
      .set(auth)
      .attach('avatar', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' })
      .expect(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects files over 5 MB', async () => {
    const { auth } = await registerUser();
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await api.post('/api/users/me/avatar').set(auth).attach('avatar', big, 'big.png').expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('requires a file', async () => {
    const { auth } = await registerUser();
    await api.post('/api/users/me/avatar').set(auth).expect(400);
  });
});

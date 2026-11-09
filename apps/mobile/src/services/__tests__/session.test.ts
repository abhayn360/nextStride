import type { AuthResponse, CurrentUser } from '@next-stride/shared';

import { useAuthStore } from '@/store/auth.store';

import { ApiError } from '../api/client';
import { createSessionManager, SESSION_EXPIRED_NOTICE, SESSION_REVOKED_NOTICE } from '../session';
import type { TokenStorage } from '../token-storage';

const user: CurrentUser = {
  id: 'u1',
  email: 'ada@example.com',
  username: 'ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  profile: {
    fullName: 'Ada Runner',
    avatarUrl: null,
    dateOfBirth: null,
    heightCm: null,
    weightKg: null,
    gender: null,
    runningExperience: null,
    preferredDistance: null,
    fitnessGoals: [],
    bio: null,
    privacy: { showAge: false, showBodyMetrics: false, showGender: false },
    isComplete: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

function response(n: number): AuthResponse {
  return { user, tokens: { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 } };
}

type MemoryStorage = TokenStorage & {
  value: string | null;
  setRefreshToken: jest.Mock<Promise<void>, [string]>;
};

function memoryStorage(initial: string | null = null): MemoryStorage {
  const storage: MemoryStorage = {
    value: initial,
    getRefreshToken: jest.fn(async (): Promise<string | null> => storage.value),
    setRefreshToken: jest.fn(async (token: string) => {
      storage.value = token;
    }),
    clear: jest.fn(async () => {
      storage.value = null;
    }),
  };
  return storage;
}

function setup(stored: string | null, refresh: jest.Mock) {
  const storage = memoryStorage(stored);
  const authApi = { refresh, logout: jest.fn(async () => undefined) };
  const onSignedOut = jest.fn();
  const session = createSessionManager({ storage, authApi, store: () => useAuthStore.getState(), onSignedOut });
  return { session, storage, authApi, onSignedOut };
}

beforeEach(() => {
  useAuthStore.setState({ status: 'restoring', user: null, accessToken: null, restoreError: null, notice: null });
});

describe('session restoration on app launch', () => {
  it('lands signed out when nothing is stored', async () => {
    const { session, authApi } = setup(null, jest.fn());
    await session.restore();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('restores the session from the stored refresh token and stores the rotated one', async () => {
    const { session, storage } = setup('refresh-0', jest.fn(async () => response(1)));
    await session.restore();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user?.id).toBe('u1');
    expect(state.accessToken).toBe('access-1');
    expect(storage.value).toBe('refresh-1');
  });

  it('signs out with a notice when the stored session has expired', async () => {
    const expired = new ApiError(401, 'TOKEN_EXPIRED', 'expired');
    const { session, storage, onSignedOut } = setup('refresh-0', jest.fn(async () => Promise.reject(expired)));
    await session.restore();

    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', notice: SESSION_EXPIRED_NOTICE });
    expect(storage.value).toBeNull();
    expect(onSignedOut).toHaveBeenCalled();
  });

  it('keeps the stored session and offers a retry when offline', async () => {
    const offline = new ApiError(0, 'NETWORK_ERROR', "Can't reach NEXT STRIDE.");
    const { session, storage } = setup('refresh-0', jest.fn(async () => Promise.reject(offline)));
    await session.restore();

    expect(useAuthStore.getState()).toMatchObject({ status: 'restoring', restoreError: "Can't reach NEXT STRIDE." });
    expect(storage.value).toBe('refresh-0');
  });
});

describe('access token refresh', () => {
  it('rotates only once for concurrent callers (single flight)', async () => {
    const refresh = jest.fn(async () => response(2));
    const { session } = setup('refresh-1', refresh);

    const tokens = await Promise.all([session.refreshAccessToken(), session.refreshAccessToken(), session.refreshAccessToken()]);
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe('access-2');
  });

  it('signs the user out when the server reports token reuse', async () => {
    const reused = new ApiError(401, 'REFRESH_TOKEN_REUSED', 'reused');
    const { session, storage } = setup('refresh-1', jest.fn(async () => Promise.reject(reused)));
    useAuthStore.getState().setSession(user, 'access-1');

    await expect(session.refreshAccessToken()).rejects.toBe(reused);
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', notice: SESSION_REVOKED_NOTICE });
    expect(storage.value).toBeNull();
  });
});

describe('sign in and sign out', () => {
  it('stores the refresh token securely on login', async () => {
    const { session, storage } = setup(null, jest.fn());
    await session.start(response(5));
    expect(storage.setRefreshToken).toHaveBeenCalledWith('refresh-5');
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'access-5' });
  });

  it('logs out locally even if the server call fails, and revokes server-side', async () => {
    const { session, storage, authApi, onSignedOut } = setup('refresh-9', jest.fn());
    authApi.logout.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    useAuthStore.getState().setSession(user, 'access-9');

    await session.signOut();
    expect(authApi.logout).toHaveBeenCalledWith('refresh-9');
    expect(storage.value).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null, accessToken: null });
    expect(onSignedOut).toHaveBeenCalled();
  });
});

import { type AuthResponse, ERROR_CODES } from '@next-stride/shared';

import type { AuthState } from '@/store/auth.store';

import { ApiError, isApiError } from './api/client';
import type { TokenStorage } from './token-storage';

export const SESSION_EXPIRED_NOTICE = 'Your session has expired. Please sign in again.';
export const SESSION_REVOKED_NOTICE = 'For your security, you were signed out. Please sign in again.';

type SessionStore = Pick<AuthState, 'setSession' | 'setAccessToken' | 'setUser' | 'setRestoring' | 'clearSession'>;

export interface SessionDeps {
  storage: TokenStorage;
  authApi: {
    refresh(refreshToken: string): Promise<AuthResponse>;
    logout(refreshToken: string): Promise<void>;
  };
  store: () => SessionStore;
  /** Called whenever the user ends up signed out (clear caches etc.). */
  onSignedOut?: () => void;
}

function noticeFor(error: unknown): string {
  if (isApiError(error) && error.code === ERROR_CODES.REFRESH_TOKEN_REUSED) return SESSION_REVOKED_NOTICE;
  return SESSION_EXPIRED_NOTICE;
}

/**
 * Owns the session lifecycle: restoring on launch, refreshing access tokens
 * (single-flight, so concurrent 401s trigger one rotation), and signing out.
 */
export function createSessionManager(deps: SessionDeps) {
  let inflightRefresh: Promise<string> | null = null;

  async function endSession(notice: string | null) {
    await deps.storage.clear().catch(() => undefined);
    deps.store().clearSession(notice);
    deps.onSignedOut?.();
  }

  async function rotate(): Promise<AuthResponse> {
    const stored = await deps.storage.getRefreshToken();
    if (!stored) throw new ApiError(401, ERROR_CODES.UNAUTHENTICATED, SESSION_EXPIRED_NOTICE);
    const response = await deps.authApi.refresh(stored);
    // Persist the rotated token before anything else: the old one is now dead.
    await deps.storage.setRefreshToken(response.tokens.refreshToken);
    return response;
  }

  return {
    /** Called once on app launch. Never throws. */
    async restore(): Promise<void> {
      deps.store().setRestoring(null);
      const stored = await deps.storage.getRefreshToken().catch(() => null);
      if (!stored) {
        deps.store().clearSession(null);
        return;
      }
      try {
        const response = await rotate();
        deps.store().setSession(response.user, response.tokens.accessToken);
      } catch (error) {
        if (isApiError(error) && error.isConnectivityError) {
          // Offline: keep the stored session and let the user retry.
          deps.store().setRestoring(error.message);
          return;
        }
        await endSession(isApiError(error) && error.status === 401 ? noticeFor(error) : null);
      }
    },

    /** After login/registration. */
    async start(response: AuthResponse): Promise<void> {
      await deps.storage.setRefreshToken(response.tokens.refreshToken);
      deps.store().setSession(response.user, response.tokens.accessToken);
    },

    refreshAccessToken(): Promise<string> {
      inflightRefresh ??= (async () => {
        try {
          const response = await rotate();
          deps.store().setAccessToken(response.tokens.accessToken);
          deps.store().setUser(response.user);
          return response.tokens.accessToken;
        } catch (error) {
          if (!(isApiError(error) && error.isConnectivityError)) await endSession(noticeFor(error));
          throw error;
        } finally {
          inflightRefresh = null;
        }
      })();
      return inflightRefresh;
    },

    /** Signs out locally right away; revoking server-side is best effort. */
    async signOut(): Promise<void> {
      const stored = await deps.storage.getRefreshToken().catch(() => null);
      await endSession(null);
      if (stored) await deps.authApi.logout(stored).catch(() => undefined);
    },
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;

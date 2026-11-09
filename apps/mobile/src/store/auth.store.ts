import type { CurrentUser } from '@next-stride/shared';
import { create } from 'zustand';

export type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated';

/**
 * In-memory session state. The access token lives only here (never on disk);
 * the refresh token lives in the secure keychain/keystore.
 */
export interface AuthState {
  status: AuthStatus;
  user: CurrentUser | null;
  accessToken: string | null;
  /** Set when session restore couldn't reach the server (we keep the stored session and offer a retry). */
  restoreError: string | null;
  /** One-off message shown on the sign-in screen, e.g. after a session expires. */
  notice: string | null;

  setSession: (user: CurrentUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: CurrentUser) => void;
  setRestoring: (restoreError?: string | null) => void;
  clearSession: (notice?: string | null) => void;
  dismissNotice: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'restoring',
  user: null,
  accessToken: null,
  restoreError: null,
  notice: null,

  setSession: (user, accessToken) =>
    set({ status: 'authenticated', user, accessToken, restoreError: null, notice: null }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setRestoring: (restoreError = null) => set({ status: 'restoring', restoreError }),
  clearSession: (notice = null) =>
    set({ status: 'unauthenticated', user: null, accessToken: null, restoreError: null, notice }),
  dismissNotice: () => set({ notice: null }),
}));

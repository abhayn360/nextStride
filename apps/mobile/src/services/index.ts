import { config } from '@/config/env';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth.store';

import { createAuthApi } from './api/auth.api';
import { createApiClient } from './api/client';
import { createRunsApi } from './api/runs.api';
import { createUsersApi } from './api/users.api';
import { createSessionManager } from './session';
import { tokenStorage } from './token-storage';

/** Composition root for the service layer. */
const apiClient = createApiClient({
  baseUrl: config.apiUrl,
  timeoutMs: config.requestTimeoutMs,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => session.refreshAccessToken(),
});

export const authApi = createAuthApi(apiClient);
export const usersApi = createUsersApi(apiClient);
export const runsApi = createRunsApi(apiClient);

export const session = createSessionManager({
  storage: tokenStorage,
  authApi,
  store: () => useAuthStore.getState(),
  onSignedOut: () => queryClient.clear(),
});

export { ApiError, isApiError } from './api/client';

import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/services/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Retry only transient failures; a 4xx won't fix itself.
      retry: (failureCount, error) =>
        failureCount < 2 && (!isApiError(error) || error.isConnectivityError || error.status >= 500),
    },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  me: ['users', 'me'] as const,
  user: (username: string) => ['users', username] as const,
};

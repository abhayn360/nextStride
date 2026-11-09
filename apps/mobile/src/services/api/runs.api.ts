import type {
  AppendPointsResponse,
  AppendRunPointsInput,
  CompleteRunInput,
  CreateRunInput,
  RunDetail,
  RunPage,
  RunProgress,
  RunStats,
  RunSummary,
  TrainingReport,
} from '@next-stride/shared';

import type { ApiClient } from './client';

export function createRunsApi(client: ApiClient) {
  return {
    create: (input: CreateRunInput) => client.request<RunSummary>('/api/runs', { method: 'POST', body: input }),
    appendPoints: (runId: string, input: AppendRunPointsInput) =>
      client.request<AppendPointsResponse>(`/api/runs/${runId}/points`, { method: 'POST', body: input }),
    complete: (runId: string, input: CompleteRunInput) =>
      client.request<RunSummary>(`/api/runs/${runId}/complete`, { method: 'POST', body: input }),
    list: (params: { limit?: number; cursor?: string | null } = {}) => {
      const query = new URLSearchParams({ limit: String(params.limit ?? 20) });
      if (params.cursor) query.set('cursor', params.cursor);
      return client.request<RunPage>(`/api/runs?${query.toString()}`);
    },
    get: (runId: string) => client.request<RunDetail>(`/api/runs/${runId}`),
    stats: (timeZone: string) => client.request<RunStats>(`/api/runs/stats?tz=${encodeURIComponent(timeZone)}`),
    progress: (timeZone: string) => client.request<RunProgress>(`/api/runs/progress?tz=${encodeURIComponent(timeZone)}`),
    report: (timeZone: string) => client.request<TrainingReport>(`/api/runs/report?tz=${encodeURIComponent(timeZone)}`),
    remove: (runId: string) => client.request<void>(`/api/runs/${runId}`, { method: 'DELETE' }),
  };
}

export type RunsApi = ReturnType<typeof createRunsApi>;

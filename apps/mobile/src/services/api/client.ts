import { type ApiErrorBody, ERROR_CODES, type ErrorCode } from '@next-stride/shared';

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ClientErrorCode,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The request never got a response — keep local state, offer a retry. */
  get isConnectivityError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Plain objects are sent as JSON; FormData is sent as multipart. */
  body?: unknown;
  /** Attach the access token and transparently refresh it on expiry (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiClientDeps {
  baseUrl: string;
  timeoutMs: number;
  getAccessToken: () => string | null;
  /** Obtain a fresh access token (single-flight). Throws ApiError when the session is over. */
  refreshAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

/** Access-token errors that a refresh can fix. */
const REFRESHABLE = new Set<string>([ERROR_CODES.TOKEN_EXPIRED, ERROR_CODES.INVALID_TOKEN]);

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const error = (body as Partial<ApiErrorBody> | undefined)?.error;
  if (error?.code && error.message) return new ApiError(status, error.code, error.message, error.fields);
  return new ApiError(status, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.');
}

export function createApiClient(deps: ApiClientDeps): ApiClient {
  const fetchImpl = deps.fetchImpl ?? fetch;

  async function send(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body; // fetch sets the multipart boundary itself
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
    options.signal?.addEventListener('abort', () => controller.abort());

    try {
      return await fetchImpl(`${deps.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Please try again.');
      }
      throw new ApiError(0, 'NETWORK_ERROR', "Can't reach NEXT STRIDE. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const auth = options.auth ?? true;
      let token = auth ? deps.getAccessToken() : null;
      // e.g. first request after a cold start, before the access token is in memory.
      if (auth && !token) token = await deps.refreshAccessToken();

      let response = await send(path, options, token);
      let body = await readBody(response);

      if (auth && response.status === 401) {
        const code = (body as Partial<ApiErrorBody> | undefined)?.error?.code;
        if (code && REFRESHABLE.has(code)) {
          token = await deps.refreshAccessToken();
          response = await send(path, options, token);
          body = await readBody(response);
        }
      }

      if (!response.ok) throw toApiError(response.status, body);
      return body as T;
    },
  };
}

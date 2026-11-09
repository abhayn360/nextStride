import { ApiError, createApiClient } from '../api/client';

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as Response;
}

function setup(responses: Response[], accessToken: string | null = 'access-1') {
  const fetchImpl = jest.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    return next;
  });
  let token = accessToken;
  const refreshAccessToken = jest.fn(async () => {
    token = 'access-2';
    return token;
  });
  const client = createApiClient({
    baseUrl: 'http://api.test',
    timeoutMs: 1000,
    getAccessToken: () => token,
    refreshAccessToken,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const authHeader = (call: number) =>
    ((fetchImpl.mock.calls[call] as unknown as [string, RequestInit])[1].headers as Record<string, string>).Authorization;
  return { client, fetchImpl, refreshAccessToken, authHeader };
}

describe('api client', () => {
  it('sends the access token as a bearer token', async () => {
    const { client, authHeader } = setup([json(200, { ok: true })]);
    await expect(client.request('/api/users/me')).resolves.toEqual({ ok: true });
    expect(authHeader(0)).toBe('Bearer access-1');
  });

  it('refreshes an expired access token and retries once', async () => {
    const { client, refreshAccessToken, authHeader } = setup([
      json(401, { error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' } }),
      json(200, { id: 'u1' }),
    ]);
    await expect(client.request('/api/users/me')).resolves.toEqual({ id: 'u1' });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authHeader(1)).toBe('Bearer access-2');
  });

  it('obtains a token first after a cold start', async () => {
    const { client, refreshAccessToken, authHeader } = setup([json(200, {})], null);
    await client.request('/api/users/me');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authHeader(0)).toBe('Bearer access-2');
  });

  it('does not refresh on public endpoints and surfaces API errors', async () => {
    const { client, refreshAccessToken } = setup([
      json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }),
    ]);
    const error = await client
      .request('/api/auth/login', { method: 'POST', body: {}, auth: false })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('passes field errors through for forms', async () => {
    const { client } = setup([
      json(409, { error: { code: 'EMAIL_TAKEN', message: 'taken', fields: { email: ['An account with this email already exists'] } } }),
    ]);
    await expect(client.request('/api/auth/register', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      fields: { email: ['An account with this email already exists'] },
    });
  });

  it('reports connectivity failures distinctly', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = createApiClient({
      baseUrl: 'http://api.test',
      timeoutMs: 1000,
      getAccessToken: () => 'a',
      refreshAccessToken: jest.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const error = (await client.request('/health').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.isConnectivityError).toBe(true);
  });
});

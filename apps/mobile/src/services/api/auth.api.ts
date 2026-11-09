import type {
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  MessageResponse,
  RegisterInput,
  ResetPasswordInput,
} from '@next-stride/shared';

import type { ApiClient } from './client';

export function createAuthApi(client: ApiClient) {
  return {
    register: (input: RegisterInput) =>
      client.request<AuthResponse>('/api/auth/register', { method: 'POST', body: input, auth: false }),
    login: (input: LoginInput) =>
      client.request<AuthResponse>('/api/auth/login', { method: 'POST', body: input, auth: false }),
    refresh: (refreshToken: string) =>
      client.request<AuthResponse>('/api/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }),
    logout: (refreshToken: string) =>
      client.request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
    forgotPassword: (input: ForgotPasswordInput) =>
      client.request<MessageResponse>('/api/auth/forgot-password', { method: 'POST', body: input, auth: false }),
    resetPassword: (input: ResetPasswordInput) =>
      client.request<MessageResponse>('/api/auth/reset-password', { method: 'POST', body: input, auth: false }),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;

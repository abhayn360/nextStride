import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from '@next-stride/shared';
import { useMutation } from '@tanstack/react-query';

import { authApi, session } from '@/services';

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (response) => session.start(response),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (response) => session.start(response),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (input: ForgotPasswordInput) => authApi.forgotPassword(input) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (input: ResetPasswordInput) => authApi.resetPassword(input) });
}

export function useLogout() {
  return useMutation({ mutationFn: () => session.signOut() });
}

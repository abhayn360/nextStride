import type {
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  MessageResponse,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from '@next-stride/shared';
import type { Request, Response } from 'express';

import { toCurrentUser } from '../mappers/user.mapper';
import type { AuthResult } from '../services/auth.service';
import { authService } from '../services/auth.service';
import type { ClientMeta } from '../services/token.service';
import { publicBaseUrl } from './request-context';

function clientMeta(req: Request): ClientMeta {
  return { userAgent: req.get('user-agent') ?? null, ipAddress: req.ip ?? null };
}

function toAuthResponse(req: Request, result: AuthResult): AuthResponse {
  return { user: toCurrentUser(result.user, publicBaseUrl(req)), tokens: result.tokens };
}

export const authController = {
  async register(req: Request<Record<string, string>, AuthResponse, RegisterInput>, res: Response<AuthResponse>) {
    const result = await authService.register(req.body, clientMeta(req));
    res.status(201).json(toAuthResponse(req, result));
  },

  async login(req: Request<Record<string, string>, AuthResponse, LoginInput>, res: Response<AuthResponse>) {
    const result = await authService.login(req.body, clientMeta(req));
    res.json(toAuthResponse(req, result));
  },

  async refresh(req: Request<Record<string, string>, AuthResponse, RefreshInput>, res: Response<AuthResponse>) {
    const result = await authService.refresh(req.body.refreshToken, clientMeta(req));
    res.json(toAuthResponse(req, result));
  },

  async logout(req: Request<Record<string, string>, void, LogoutInput>, res: Response) {
    await authService.logout(req.body.refreshToken);
    res.status(204).end();
  },

  async forgotPassword(req: Request<Record<string, string>, MessageResponse, ForgotPasswordInput>, res: Response<MessageResponse>) {
    await authService.requestPasswordReset(req.body);
    res.status(202).json({ message: 'If an account exists for that email, a reset link is on its way.' });
  },

  async resetPassword(req: Request<Record<string, string>, MessageResponse, ResetPasswordInput>, res: Response<MessageResponse>) {
    await authService.resetPassword(req.body);
    res.json({ message: 'Your password has been reset. Please sign in.' });
  },
};

import type { CurrentUser, PublicProfile, UpdateProfileInput } from '@next-stride/shared';
import type { Request, Response } from 'express';

import { toCurrentUser, toPublicProfile } from '../mappers/user.mapper';
import { requireUserId } from '../middleware/authenticate';
import { userService } from '../services/user.service';
import { Errors } from '../utils/errors';
import { publicBaseUrl } from './request-context';

export const userController = {
  async getMe(req: Request, res: Response<CurrentUser>) {
    const user = await userService.getById(requireUserId(req));
    res.json(toCurrentUser(user, publicBaseUrl(req)));
  },

  async updateMe(req: Request<Record<string, string>, CurrentUser, UpdateProfileInput>, res: Response<CurrentUser>) {
    const user = await userService.updateProfile(requireUserId(req), req.body);
    res.json(toCurrentUser(user, publicBaseUrl(req)));
  },

  async uploadAvatar(req: Request, res: Response<CurrentUser>) {
    if (!req.file) throw Errors.validation({ avatar: ['Attach an image in the "avatar" field'] });
    const user = await userService.setAvatar(requireUserId(req), req.file.buffer);
    res.json(toCurrentUser(user, publicBaseUrl(req)));
  },

  async deleteAvatar(req: Request, res: Response<CurrentUser>) {
    const user = await userService.removeAvatar(requireUserId(req));
    res.json(toCurrentUser(user, publicBaseUrl(req)));
  },

  async getByUsername(req: Request<{ username: string }>, res: Response<PublicProfile>) {
    const user = await userService.getByUsername(req.params.username);
    res.json(toPublicProfile(user, publicBaseUrl(req)));
  },
};

import { updateProfileSchema, usernameParamSchema } from '@next-stride/shared';
import { Router } from 'express';
import multer from 'multer';

import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { AVATAR_MAX_BYTES } from '../services/avatar-storage.service';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 },
});

export function userRoutes(): Router {
  const router = Router();

  // Everything under /users requires a valid access token.
  router.use(authenticate);

  // `/me` routes are declared before `/:username` so they always win.
  router.get('/me', userController.getMe);
  router.put('/me', validate({ body: updateProfileSchema }), userController.updateMe);
  router.post('/me/avatar', avatarUpload.single('avatar'), userController.uploadAvatar);
  router.delete('/me/avatar', userController.deleteAvatar);
  router.get('/:username', validate({ params: usernameParamSchema }), userController.getByUsername);

  return router;
}

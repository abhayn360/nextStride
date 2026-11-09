import type { Request } from 'express';

import { env } from '../config/env';

/** Base URL used to make stored relative paths (e.g. avatars) absolute. */
export function publicBaseUrl(req: Request): string {
  return env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

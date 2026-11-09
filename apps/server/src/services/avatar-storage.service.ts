import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';
import { generateOpaqueToken } from '../utils/crypto';
import { Errors } from '../utils/errors';

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const PUBLIC_PREFIX = '/uploads/avatars/';

/** Sniff the real file type from magic bytes — never trust the client's Content-Type. */
function detectImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function uploadsRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
}

/**
 * Local-disk storage for Phase 1. The interface (save → public path, remove)
 * is deliberately small so it can be swapped for S3/GCS without touching callers.
 */
export const avatarStorage = {
  async save(userId: string, buffer: Buffer): Promise<string> {
    const ext = detectImageType(buffer);
    if (!ext) throw Errors.unsupportedMediaType('Profile pictures must be JPEG, PNG or WebP images');

    const dir = path.join(uploadsRoot(), 'avatars');
    await mkdir(dir, { recursive: true });
    const filename = `${userId}-${generateOpaqueToken(9)}.${ext}`;
    await writeFile(path.join(dir, filename), buffer, { mode: 0o644 });
    return `${PUBLIC_PREFIX}${filename}`;
  },

  async remove(publicPath: string | null | undefined): Promise<void> {
    if (!publicPath?.startsWith(PUBLIC_PREFIX)) return;
    const filename = path.basename(publicPath);
    await unlink(path.join(uploadsRoot(), 'avatars', filename)).catch(() => undefined);
  },
};

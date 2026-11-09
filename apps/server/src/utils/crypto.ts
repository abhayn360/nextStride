import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** URL-safe, high-entropy opaque token (default 384 bits). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored hashed so a database leak cannot be replayed. SHA-256 is fine for high-entropy secrets. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export { randomUUID };

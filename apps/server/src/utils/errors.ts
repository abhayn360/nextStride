import { ERROR_CODES, type ErrorCode } from '@next-stride/shared';

/** An expected, client-facing error. Anything else is reported as a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string[]>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (fields: Record<string, string[]>, message = 'Some fields are invalid') =>
    new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, fields),
  invalidCredentials: () => new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password'),
  unauthenticated: (message = 'Authentication required') =>
    new AppError(401, ERROR_CODES.UNAUTHENTICATED, message),
  tokenExpired: (message = 'Your session has expired') => new AppError(401, ERROR_CODES.TOKEN_EXPIRED, message),
  invalidToken: (message = 'Invalid or revoked token') => new AppError(401, ERROR_CODES.INVALID_TOKEN, message),
  refreshTokenReused: () =>
    new AppError(
      401,
      ERROR_CODES.REFRESH_TOKEN_REUSED,
      'This session was ended for your security. Please sign in again.',
    ),
  invalidResetToken: () =>
    new AppError(400, ERROR_CODES.INVALID_RESET_TOKEN, 'This reset link is invalid or has expired'),
  emailTaken: () =>
    new AppError(409, ERROR_CODES.EMAIL_TAKEN, 'An account with this email already exists', {
      email: ['An account with this email already exists'],
    }),
  usernameTaken: () =>
    new AppError(409, ERROR_CODES.USERNAME_TAKEN, 'This username is taken', {
      username: ['This username is taken'],
    }),
  notFound: (message = 'Not found') => new AppError(404, ERROR_CODES.NOT_FOUND, message),
  unsupportedMediaType: (message: string) => new AppError(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, message),
  payloadTooLarge: (message = 'Payload too large') => new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, message),
  runAlreadyCompleted: () =>
    new AppError(409, ERROR_CODES.RUN_ALREADY_COMPLETED, 'This run is already completed and can no longer change'),
  runPointsMissing: (storedPoints: number, expectedPoints: number) =>
    new AppError(
      409,
      ERROR_CODES.RUN_POINTS_MISSING,
      `The server has ${storedPoints} of ${expectedPoints} GPS points for this run. Upload the rest, then complete it.`,
      undefined,
      { storedPoints, expectedPoints },
    ),
};

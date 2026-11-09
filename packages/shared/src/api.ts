import type { FitnessGoal, Gender, PreferredDistance, RunningExperience } from './enums';

/** Machine readable error codes returned in `error.code`. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RUN_ALREADY_COMPLETED: 'RUN_ALREADY_COMPLETED',
  RUN_POINTS_MISSING: 'RUN_POINTS_MISSING',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Field level messages for VALIDATION_ERROR, keyed by dotted path. */
    fields?: Record<string, string[]>;
    /** Extra machine-readable context, e.g. `{ storedPoints }` for RUN_POINTS_MISSING. */
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface PrivacySettings {
  showAge: boolean;
  showBodyMetrics: boolean;
  showGender: boolean;
}

/** The authenticated user's own, complete view of their account. */
export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  profile: {
    fullName: string;
    avatarUrl: string | null;
    dateOfBirth: string | null;
    heightCm: number | null;
    weightKg: number | null;
    gender: Gender | null;
    runningExperience: RunningExperience | null;
    preferredDistance: PreferredDistance | null;
    fitnessGoals: FitnessGoal[];
    bio: string | null;
    privacy: PrivacySettings;
    isComplete: boolean;
    updatedAt: string;
  };
}

/** What anyone signed in may see about another user. Never includes email or raw date of birth. */
export interface PublicProfile {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  runningExperience: RunningExperience | null;
  preferredDistance: PreferredDistance | null;
  fitnessGoals: FitnessGoal[];
  memberSince: string;
  /** Present only when the user opted in. */
  age?: number;
  heightCm?: number | null;
  weightKg?: number | null;
  gender?: Gender | null;
}

export interface TokenPair {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
}

export interface AuthResponse {
  user: CurrentUser;
  tokens: TokenPair;
}

export interface MessageResponse {
  message: string;
}

# NEXT STRIDE API

Base URL (development): `http://localhost:4000`

All request and response bodies are JSON unless noted. Authenticated endpoints take
`Authorization: Bearer <accessToken>`.

## Conventions

### Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "fields": { "email": ["Enter a valid email address"] },
    "requestId": "8b0e1c6e-…"
  }
}
```

- `code` is stable and machine-readable (see the table below). `message` is safe to show to users.
- `fields` is present for field-level problems, keyed by field name.
- `details` carries extra machine-readable context for some errors.
- `requestId` matches the `X-Request-Id` response header and the server logs.

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body or params failed validation, or the JSON is malformed |
| `INVALID_RESET_TOKEN` | 400 | Password reset token is unknown, used or expired |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password. The response is identical whether or not the email exists |
| `UNAUTHENTICATED` | 401 | No or malformed `Authorization` header |
| `TOKEN_EXPIRED` | 401 | Access token or refresh session expired. Clients should refresh, or sign in again |
| `INVALID_TOKEN` | 401 | Token is invalid, revoked, or its session has ended |
| `REFRESH_TOKEN_REUSED` | 401 | A rotated refresh token was replayed, so the whole session was revoked |
| `NOT_FOUND` | 404 | Unknown route or username |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | Uniqueness conflict |
| `RUN_ALREADY_COMPLETED` | 409 | Points were sent for a run that is already completed |
| `RUN_POINTS_MISSING` | 409 | Completion refused: the server has fewer points than the device recorded. `details` holds `storedPoints` and `expectedPoints` |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 20 KB, or avatar over 5 MB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Avatar isn't a JPEG, PNG or WebP image (checked by file signature) |
| `RATE_LIMITED` | 429 | Too many attempts. See the `RateLimit` and `Retry-After` headers |
| `INTERNAL_ERROR` | 500 | Unexpected failure. Details are logged server-side, never returned |

### Tokens

- **Access token:** HS256 JWT, valid for 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`). Keep it in memory only.
- **Refresh token:** an opaque 384-bit random string, valid for 30 days (`REFRESH_TOKEN_TTL_DAYS`). Store it in the platform keychain or keystore. The server stores only its SHA-256 hash.
- **Rotation:** every `/refresh` returns a new refresh token and invalidates the old one. Presenting an already-rotated token revokes the entire session (`REFRESH_TOKEN_REUSED`).

### Rate limits

Limits are counted per client IP.

- `register`, `login`, `forgot-password`, `reset-password` share a budget: 10 requests per 15 minutes by default (`AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MINUTES`).
- `refresh` and `logout` get 6× that budget.

### Shared types

Request schemas and response types live in [`packages/shared`](../packages/shared/src). Both the API and the app import them, so validation rules can't drift between client and server.

---

## Auth

### `POST /api/auth/register`

Creates an account and signs it in. Rate limited.

```json
{ "fullName": "Ada Runner", "username": "ada_runs", "email": "ada@example.com", "password": "stride123" }
```

| Field | Rules |
| --- | --- |
| `fullName` | 1–80 characters |
| `username` | 3–20 characters: lowercase letters, digits and `_`, starting with a letter. Normalised to lowercase. Reserved names such as `me` and `admin` are rejected |
| `email` | Valid email. Trimmed and lowercased |
| `password` | 8–128 characters, with at least one letter and one number |

**201** returns an `AuthResponse`:

```json
{
  "user": { "id": "…", "email": "ada@example.com", "username": "ada_runs", "createdAt": "…", "profile": { "…": "see CurrentUser" } },
  "tokens": { "accessToken": "eyJ…", "refreshToken": "q8…", "expiresIn": 900 }
}
```

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`, `409 USERNAME_TAKEN`, `429`.

### `POST /api/auth/login`

```json
{ "email": "ada@example.com", "password": "stride123" }
```

**200** returns an `AuthResponse`. Errors: `400`, `401 INVALID_CREDENTIALS`, `429`.

### `POST /api/auth/refresh`

```json
{ "refreshToken": "q8…" }
```

**200** returns an `AuthResponse` with a **new** refresh token, which replaces the stored one. The app also calls this on launch to restore the session.

Errors: `401 INVALID_TOKEN` (unknown or ended session), `401 TOKEN_EXPIRED`, `401 REFRESH_TOKEN_REUSED`.

### `POST /api/auth/logout`

```json
{ "refreshToken": "q8…" }
```

**204**. Ends this device's session; other devices stay signed in. Idempotent: unknown tokens also return 204.

### `POST /api/auth/forgot-password`

```json
{ "email": "ada@example.com" }
```

**202** `{ "message": "If an account exists for that email, a reset link is on its way." }`

The response is identical for unknown emails. The token and email work run after the response is sent, so timing doesn't reveal which emails exist.

If the account exists, the server emails a single-use link, `PASSWORD_RESET_URL?token=…`, valid for 30 minutes. Requesting a new link invalidates older ones. In development the email is printed to the server log.

### `POST /api/auth/reset-password`

```json
{ "token": "…", "password": "newStride456" }
```

**200** `{ "message": "Your password has been reset. Please sign in." }`

A successful reset revokes every refresh token for the account. It also bumps the account's token version, so outstanding access tokens stop working immediately.

Errors: `400 INVALID_RESET_TOKEN`, `400 VALIDATION_ERROR`.

---

## Users

Every `/api/users` route requires a valid access token.

### `GET /api/users/me`

**200** returns the signed-in user's `CurrentUser`:

```json
{
  "id": "2e89…",
  "email": "ada@example.com",
  "username": "ada_runs",
  "createdAt": "2026-11-06T07:01:09.975Z",
  "profile": {
    "fullName": "Ada Runner",
    "avatarUrl": "http://localhost:4000/uploads/avatars/2e89…-Xy.png",
    "dateOfBirth": "1994-05-12",
    "heightCm": 172.5,
    "weightKg": 64,
    "gender": "FEMALE",
    "runningExperience": "INTERMEDIATE",
    "preferredDistance": "HALF_MARATHON",
    "fitnessGoals": ["GET_FASTER", "TRAIN_FOR_RACE"],
    "bio": "Chasing a sub-90 half.",
    "privacy": { "showAge": false, "showBodyMetrics": false, "showGender": false },
    "isComplete": true,
    "updatedAt": "…"
  }
}
```

`isComplete` is true once `dateOfBirth`, `runningExperience`, `preferredDistance` and at least one fitness goal are set. The app uses it to decide whether to show profile setup.

### `PUT /api/users/me`

Partial update: only the fields you send change. Unknown fields are rejected, so `passwordHash` or `id` can't be smuggled in. Optional personal fields accept `null` to clear them.

```json
{
  "fullName": "Ada L. Runner",
  "username": "ada_l",
  "email": "new@example.com",
  "currentPassword": "stride123",
  "dateOfBirth": "1994-05-12",
  "heightCm": 172.5,
  "weightKg": null,
  "gender": "FEMALE",
  "runningExperience": "ADVANCED",
  "preferredDistance": "MARATHON",
  "fitnessGoals": ["TRAIN_FOR_RACE"],
  "bio": "…",
  "privacy": { "showAge": true }
}
```

- `currentPassword` is required only when `email` changes. A missing or wrong password returns `400` with `fields.currentPassword`.
- `dateOfBirth` uses `YYYY-MM-DD`; the user must be at least 13.
- `heightCm` must be 50–272. `weightKg` must be 20–400. `bio` is at most 280 characters.

Enum values:

| Field | Values |
| --- | --- |
| `gender` | `FEMALE`, `MALE`, `NON_BINARY`, `PREFER_NOT_TO_SAY` |
| `runningExperience` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `ELITE` |
| `preferredDistance` | `FIVE_K`, `TEN_K`, `HALF_MARATHON`, `MARATHON`, `ULTRA`, `NO_PREFERENCE` |
| `fitnessGoals[]` | `BUILD_HABIT`, `LOSE_WEIGHT`, `IMPROVE_ENDURANCE`, `GET_FASTER`, `TRAIN_FOR_RACE`, `STAY_HEALTHY`, `REDUCE_STRESS` |

**200** returns the updated `CurrentUser`. Errors: `400`, `409 EMAIL_TAKEN`, `409 USERNAME_TAKEN`.

### `POST /api/users/me/avatar`

`multipart/form-data` with a single file in the field `avatar`. The file must be a JPEG, PNG or WebP image of at most 5 MB. The type is detected from the file signature, not from the declared `Content-Type`. Replacing an avatar deletes the old file.

**200** returns `CurrentUser`. Errors: `400` (no file), `413`, `415`.

### `DELETE /api/users/me/avatar`

**200** returns `CurrentUser` with `avatarUrl: null`.

### `GET /api/users/:username`

Another runner's public profile. The lookup is case-insensitive.

```json
{
  "username": "paula",
  "fullName": "Paula R.",
  "avatarUrl": null,
  "bio": "Marathoner",
  "runningExperience": "ELITE",
  "preferredDistance": "MARATHON",
  "fitnessGoals": ["TRAIN_FOR_RACE"],
  "memberSince": "2026-11-06T07:01:09.975Z",
  "age": 31
}
```

- `email` and the exact date of birth are never returned.
- `age`, `heightCm`/`weightKg` and `gender` appear only when the owner turned on `showAge`, `showBodyMetrics` or `showGender`. All three are off by default.

Errors: `404 NOT_FOUND`.

---

## Runs

Every `/api/runs` route requires a valid access token. Runs belong to their creator only: another user's run id returns `404`, exactly like an id that doesn't exist. Malformed ids also return `404`.

### Values: measured vs estimated

| Field | Kind | How it's obtained |
| --- | --- | --- |
| `distanceMeters` | Measured | Haversine distance between filtered GPS fixes. Never measured across a pause |
| `durationSeconds` | Measured | Active time from the device clock, excluding pauses. Capped at the wall-clock span |
| `movingTimeSeconds` | Measured | Time between fixes while moving at 0.5 m/s or faster |
| `averagePaceSecondsPerKm` / `averageSpeed` (m/s) | Derived | From distance and moving time |
| `caloriesEstimate` | **Estimate** | About 1.036 kcal per kg per km. Uses the profile weight, or 70 kg if unset |

The server computes all of these from the stored points when the run completes, using the same algorithm the app uses live (`packages/shared/src/run-metrics.ts`). The client's own numbers are never trusted.

GPS filtering removes:

- invalid coordinates and (0, 0);
- fixes with accuracy worse than 50 m;
- duplicate or out-of-order timestamps;
- jumps implying more than 12 m/s;
- standing-still jitter: movement under max(3 m, 2× the reported accuracy).

On simulated noisy tracks, distance stays within 3%.

### `POST /api/runs`

Starts a run.

```json
{ "clientId": "6f1c2b3a-…-uuid", "startedAt": "2026-11-06T07:00:00.000Z" }
```

`clientId` is a UUID the device generates when the run starts. It is the idempotency key: repeating the request returns the same run (**200**) instead of creating a duplicate. The first call returns **201** with a `RunSummary` in status `IN_PROGRESS`.

### `POST /api/runs/:id/points`

Appends 1 to 1000 GPS fixes. The body is limited to 512 KB.

```json
{
  "points": [
    { "latitude": 51.5074, "longitude": -0.1278, "altitude": 12, "accuracy": 5, "recordedAt": "2026-11-06T07:00:01.000Z", "segment": 0 }
  ]
}
```

- `segment` increments each time the run is resumed after a pause.
- Points must fall between 60 s before `startedAt` and 5 min after now (clock-skew tolerance).
- A fix with the same `recordedAt` as one already stored is skipped. Re-sending a batch after a lost response is therefore safe.

**200** returns `{ "received": 15, "stored": 5, "duplicates": 10, "totalPoints": 15 }`.

Errors: `400`, `404`, `409 RUN_ALREADY_COMPLETED`.

### `POST /api/runs/:id/complete`

```json
{ "completedAt": "2026-11-06T07:42:10.000Z", "durationSeconds": 2410, "pointCount": 2501 }
```

- `durationSeconds` is the active time measured on the device.
- `pointCount` is how many points the device recorded.

The server first **reconciles**: if it holds fewer points than `pointCount`, it answers `409 RUN_POINTS_MISSING`, and the client re-uploads, then retries. Then it computes the metrics, stores a downsampled `routePreview`, and marks the run `COMPLETED`.

Completion is **idempotent**. Completing an already-completed run (including concurrent requests) returns the stored result unchanged, so a late retry can't rewrite it.

**200** returns a `RunSummary`:

```json
{
  "id": "…", "clientId": "…", "status": "COMPLETED",
  "startedAt": "…", "completedAt": "…",
  "distanceMeters": 8012.4, "durationSeconds": 2410, "movingTimeSeconds": 2378,
  "averagePaceSecondsPerKm": 296.8, "averageSpeed": 3.369, "caloriesEstimate": 498,
  "pointCount": 2501,
  "routePreview": [[[-0.1278, 51.5074], [-0.1265, 51.5085]]]
}
```

### `GET /api/runs?limit=20&cursor=…`

Lists completed runs, newest first. `limit` is 1–50 (default 20). Results are keyset-paginated: pass `nextCursor` from the previous page, and stop when it is `null`. In-progress runs are not listed.

**200** returns `{ "items": RunSummary[], "nextCursor": "…" | null }`.

### `GET /api/runs/:id`

**200** returns a `RunDetail`. That is a `RunSummary` plus:

- `points`: every stored fix, in time order;
- `splits`: per-kilometre splits, as `{ index, distanceMeters, durationSeconds, paceSecondsPerKm }`. The final split may be partial.

### `GET /api/runs/stats?tz=Europe/London`

Weeks start on Monday and are computed in `tz`, which must be an IANA time zone (default `UTC`).

**200** returns:

```json
{
  "timeZone": "Europe/London",
  "totals": { "runs": 42, "distanceMeters": 251034.2, "durationSeconds": 86400, "movingTimeSeconds": 84211 },
  "thisWeek": { "runs": 3, "distanceMeters": 18200, "durationSeconds": 6100 },
  "thisMonth": { "runs": 9, "distanceMeters": 61000, "durationSeconds": 20500 },
  "daily":   [{ "date": "2026-11-02", "runs": 1, "distanceMeters": 5000, "durationSeconds": 1600 }],
  "weekly":  [{ "weekStart": "2026-09-14", "runs": 4, "distanceMeters": 21000, "durationSeconds": 7000 }],
  "monthly": [{ "month": "2026-06", "runs": 12, "distanceMeters": 80000, "durationSeconds": 27000 }],
  "personalBests": {
    "longestDistance": { "runId": "…", "distanceMeters": 21240, "startedAt": "…" },
    "longestDuration": { "runId": "…", "durationSeconds": 7012, "startedAt": "…" },
    "fastestPace":     { "runId": "…", "paceSecondsPerKm": 271.5, "startedAt": "…" }
  },
  "averages": { "distancePerRunMeters": 5977, "paceSecondsPerKm": 335 }
}
```

- `daily` has 7 entries, Monday through Sunday of the current week.
- `weekly` covers the last 8 weeks and `monthly` the last 6 months, oldest first. Empty periods are included with zeros.
- `fastestPace` considers only runs of at least 1 km.

### `DELETE /api/runs/:id`

**204**. Deletes the run and its points. Errors: `404`.

---

## Other

- `GET /health` returns `{ "status": "ok" }`. No authentication.
- `GET /uploads/avatars/:file` serves uploaded profile pictures. File names are unguessable, and there is no directory listing.

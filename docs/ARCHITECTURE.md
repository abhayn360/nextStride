# Architecture

## Monorepo

```
next-stride/
├── apps/
│   ├── mobile/                 Expo (SDK 58) + Expo Router app
│   └── server/                 Express 5 REST API + Prisma 7 / PostgreSQL
├── packages/
│   └── shared/                 Zod schemas, enums, API types (used by both apps)
└── docs/                       API reference, architecture, design system
```

The repo uses npm workspaces. `packages/shared` has two consumers:

- **The app** reads its TypeScript source directly, through the `react-native` export condition that Metro and the app's tsconfig both use.
- **The server** reads compiled CommonJS from `dist/`, which root `postinstall` builds.

## Server (`apps/server`)

A layered design with one responsibility per layer:

```
src/
├── index.ts             Bootstrap: connect, listen, housekeeping, graceful shutdown
├── app.ts               createApp(): middleware stack and routers. Tests can override options
├── config/env.ts        Zod-validated environment; the process refuses to start if invalid
├── routes/              URL → middleware → controller wiring
├── controllers/         HTTP in/out only: read req, call a service, map to a DTO
├── services/            Business rules (auth, tokens, profile, avatar storage, mail)
├── repositories/        All Prisma access; accept a transaction client
├── mappers/             DB rows → public DTOs (CurrentUser, PublicProfile)
├── middleware/          authenticate, validate, rate-limit, error-handler
├── utils/               jwt, password (argon2id), crypto, AppError
├── lib/                 Prisma client (pg driver adapter), pino logger
└── generated/prisma/    Generated Prisma client (gitignored)
```

Each layer has firm boundaries:

- **Controllers never touch Prisma.** They call services.
- **Services never touch `req`/`res`.** They call repositories.
- **Responses always pass through a mapper.** That keeps fields like `passwordHash` and `tokenVersion` from leaking.
- **Errors are thrown as `AppError`.** Express 5 forwards async errors to the central `errorHandler`, which renders the single error shape.

### Data model

Defined in `prisma/schema.prisma`; migrations live in `prisma/migrations`.

| Table | Purpose | Keys and indexes |
| --- | --- | --- |
| `users` | Credentials and identity | PK `id` (uuid); unique `email`, `username`; index `created_at` |
| `user_profiles` | Personal and running profile, privacy flags | PK `id`; unique FK `user_id` → users (cascade); index `running_experience` |
| `refresh_tokens` | Hashed refresh tokens grouped by session family | PK `id`; unique `token_hash`, `replaced_by_id`; FK `user_id` (cascade); indexes `user_id`, `family_id`, `expires_at` |
| `password_reset_tokens` | Hashed single-use reset tokens | PK `id`; unique `token_hash`; FK `user_id` (cascade); indexes `user_id`, `expires_at` |
| `runs` | One recorded run with its server-computed metrics and route preview | PK `id`; FK `user_id` (cascade); unique (`user_id`, `client_id`) for idempotent creation; indexes (`user_id`, `status`, `started_at` desc) and (`user_id`, `status`, `distance_meters` desc) |
| `run_points` | Timestamped GPS fixes | PK `id` (bigint); FK `run_id` (cascade); unique (`run_id`, `recorded_at`), which deduplicates uploads and serves ordered reads |

Every table has `created_at` and `updated_at`. Email and username are stored lowercase; the shared schemas normalise them, so plain unique indexes are case-insensitive in practice.

### Authentication design

```
login/register ──► access JWT (15 min, memory) + refresh token (30 d, keychain)
                         │
  API call ──401 TOKEN_EXPIRED──► POST /refresh ──► new pair; old refresh revoked
                         │
  replay of a revoked-and-replaced token ──► revoke whole family (all tokens from that login)
```

- **Passwords:** hashed with Argon2id (19 MiB, t=2, p=1, the OWASP baseline). Hashes are upgraded transparently on login if the parameters change. Login against an unknown email still runs a password verification, so response time doesn't reveal whether an account exists.
- **Access tokens:** HS256 with fixed `iss`/`aud`, and only the HS256 algorithm is accepted. Tokens carry `ver` = `users.token_version`. `authenticate` checks `ver` against the database on every request, so a password reset or deleted account takes effect immediately.
- **Refresh tokens:** opaque random strings, stored as SHA-256 hashes. Rotation runs in a transaction with a conditional `UPDATE … WHERE revoked_at IS NULL`. When two concurrent refreshes race, exactly one wins; the loser is treated as reuse.
- **Logout:** revokes that session's family; other devices stay signed in.
- **Forgot password:** always returns 202, and the work runs after the response. Each new request invalidates earlier links. A reset revokes all sessions. Mail delivery sits behind a `MailTransport` interface: console in development, memory in tests, a real provider later.
- **Housekeeping:** expired tokens are purged every 6 hours.

### Security controls

- **Input validation:** every body and param goes through a Zod schema. `PUT /me` is `.strict()`, so unknown fields are rejected.
- **Rate limiting:** credential endpoints are limited per IP; refresh gets a separate, larger budget.
- **Transport and headers:** CORS allows only the configured browser origins (native apps send no `Origin`). `helmet` sets security headers, `x-powered-by` is disabled, and JSON bodies are capped at 20 KB.
- **Uploads:** checked by magic bytes and capped at 5 MB, with random file names and no directory listing.
- **Secrets and logging:** secrets come only from the environment. Logs redact `Authorization`, passwords and tokens.
- **Error responses:** 500s return a generic message plus a `requestId`, never a stack trace.

## Mobile (`apps/mobile`)

```
src/
├── app/                    Expo Router routes (thin: re-export screens)
│   ├── _layout.tsx         Providers, fonts, splash, session restore, route guards
│   ├── index.tsx           Redirects to the right place for the session state
│   ├── (public)/           onboarding, welcome, login, register, forgot/reset password
│   ├── profile-setup.tsx
│   └── (app)/              (tabs)/home|activities|profile|settings, edit-profile, run, activity/[id]
├── screens/                Screen components
├── components/
│   ├── ui/                 Design-system components (Button, TextField, Card, …)
│   ├── brand/              Logo, illustrations, session notice
│   ├── navigation/         TabBar, ScreenHeader
│   ├── map/                RouteMap (MapLibre), RouteSketch (SVG fallback), route geometry
│   ├── run/                GpsBadge, HoldButton, RunCard, BarChart
│   └── profile/            Profile field pickers shared by setup and edit
├── hooks/                  useForm, auth mutations, profile queries and mutations
├── services/
│   ├── api/                Fetch client (auth + refresh + errors), auth, users and runs APIs
│   ├── location/           Location permissions, tracker, background TaskManager task
│   ├── run/                Run session (recording), SQLite store, sync engine
│   ├── session.ts          Session lifecycle (restore, refresh single-flight, sign out)
│   ├── token-storage.ts    SecureStore (Keychain/Keystore) for the refresh token
│   └── index.ts            Composition root
├── store/                  Zustand: auth (memory only), preferences (AsyncStorage)
├── theme/                  Design tokens and ThemeProvider
├── lib/                    TanStack Query client, formatting helpers
└── config/env.ts           API URL resolution
```

### Navigation and guards

The root `Stack` uses `Stack.Protected`, so exactly one area is reachable for any session state:

| State | Reachable |
| --- | --- |
| signed out | `(public)`. `onboarding` is guarded by "not yet seen" |
| signed in, profile incomplete | `profile-setup` |
| signed in, profile complete | `(app)` |

When state changes (login, logout, profile completed, session expired), the active guard fails. The router then falls back to the `index` anchor, which redirects to the right screen, so screens never navigate after auth events themselves.

### State

- **Auth store (Zustand, memory only):** `status`, `user`, `accessToken`, notices.
- **Preferences store (Zustand + AsyncStorage):** theme preference and the onboarding flag. Nothing sensitive is kept here.
- **Run store (Zustand, memory only):** the live view of the current run. The durable copy is in SQLite. See [RUN_TRACKING.md](RUN_TRACKING.md).
- **Server state (TanStack Query):** `/me` refreshes keep the auth store's user current; mutations write back to both.

### Session lifecycle

1. **Launch:** the native splash hands off to `BrandSplash`. `session.restore()` reads the refresh token from SecureStore and calls `/refresh`, then stores the rotated token.
   - **Success:** the user is signed in.
   - **401:** the token is cleared and the user is signed out, with a "session expired" notice.
   - **Network error:** the token is kept, and the splash offers Retry.
2. **API calls:** the client attaches the in-memory access token. On `401 TOKEN_EXPIRED` or `INVALID_TOKEN` it refreshes once (single-flight, so parallel 401s cause one rotation) and retries.
3. **Logout:** local state clears immediately, and server-side revocation is best effort.

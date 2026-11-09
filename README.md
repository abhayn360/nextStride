# NEXT STRIDE

**Every Run. A Step Forward.**

NEXT STRIDE is a running app. This repository currently holds:

- **Phase 1:** the project foundation, authentication, user profiles, and the design system used by every later phase.
- **Phase 2:** the running engine. GPS tracking (including with the screen locked), the live run screen, MapLibre route maps, offline recording with background sync, activity history and statistics.

- **Phase 3:** training analysis and progression. Pace zones, elevation, best efforts and pacing for every run, plus XP, levels, streaks, weekly quests and badges. A voice coach for splits and zone alerts, and a weekly training report.

Social and AI features belong to later phases and are not implemented here.

| | |
| --- | --- |
| **Mobile** | React Native 0.88 · Expo SDK 58 · TypeScript · Expo Router · Zustand · TanStack Query |
| **API** | Node.js · Express 5 · TypeScript · Zod · REST |
| **Database** | PostgreSQL · Prisma 7 |
| **Auth** | Argon2id passwords · JWT access tokens · rotating refresh tokens in the device keychain |
| **Tracking** | expo-location + expo-task-manager · expo-sqlite (offline store) · MapLibre React Native with OpenStreetMap tiles |

```
apps/mobile      Expo app
apps/server      REST API, Prisma schema and migrations
packages/shared  Zod schemas, enums and API types shared by both
docs/            API reference, architecture, design system
```

## Documentation

- [API reference](docs/API.md): every endpoint, request and response shapes, error codes.
- [Architecture](docs/ARCHITECTURE.md): layers, data model, auth and session design, navigation guards.
- [Run tracking](docs/RUN_TRACKING.md): GPS pipeline, filtering, offline sync, maps, and **iOS/Android background limitations**.
- [Design system](docs/DESIGN_SYSTEM.md): tokens, typography, components and rules.

## Setup

**Prerequisites:**

- Node 20.19+ (developed on 22)
- PostgreSQL 14+, either local or via Docker
- An iOS simulator, an Android emulator, or a phone with Expo Go

### 1. Install

```bash
npm install          # installs all workspaces, builds packages/shared, generates the Prisma client
```

### 2. Database

Use Docker:

```bash
docker compose up -d            # Postgres on :5432 with next_stride and next_stride_test
```

…or an existing PostgreSQL:

```bash
createdb next_stride && createdb next_stride_test
```

### 3. Configure the API

```bash
cp apps/server/.env.example apps/server/.env
```

Then edit `apps/server/.env`:

- Set `DATABASE_URL` and `TEST_DATABASE_URL` for your database. The Docker defaults work as-is.
- Set `JWT_ACCESS_SECRET` to a long random value. Generate one with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

### 4. Migrate and run

```bash
npm run db:migrate              # applies prisma/migrations to DATABASE_URL
npm run dev:server              # http://localhost:4000 (also reachable on your LAN)
npm run dev:mobile              # Expo dev server — press i (iOS), a (Android), or scan the QR code
```

Expo Go is enough for Phase 1 screens. **GPS tracking with the screen locked and real map tiles need a development build**, because they rely on native code Expo Go doesn't include:

```bash
cd apps/mobile
npx expo run:ios        # or: npx expo run:android  (needs Xcode / Android Studio, ~10+ GB free disk)
```

In Expo Go, runs still record while the app is open, and routes are drawn as an outline instead of a tiled map.

The app finds the API automatically: it uses the machine running Metro, on port 4000. On an Android phone connected by USB, the development build loads from `localhost` through `adb reverse`, so forward the API port as well (redo this after re-plugging the phone):

```bash
cd apps/mobile && npm run reverse   # adb reverse tcp:4000 tcp:4000
``` To point it somewhere else, set `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`).

> **Password reset in development:** emails go to the API's console log. Open the link on the device, or copy the `token` value into **Forgot password → I have a reset code**.

### Environment variables

| File | Purpose |
| --- | --- |
| [`apps/server/.env.example`](apps/server/.env.example) | Database, JWT secret and token lifetimes, CORS origins, rate limits, reset link, logging |
| [`apps/mobile/.env.example`](apps/mobile/.env.example) | `EXPO_PUBLIC_API_URL` (optional in development), map style URLs |

`.env` files are gitignored. Never put secrets in `EXPO_PUBLIC_*` variables, because they are bundled into the app.

## Testing

```bash
npm test                        # shared + server + mobile
npm run typecheck               # all workspaces
```

| Suite | Command | What it covers |
| --- | --- | --- |
| Shared | `npm test -w @next-stride/shared` | Validation rules; run maths: Haversine, GPS filtering (noise, jumps, jitter, duplicates), pace, speed, moving time, pauses, splits, calories |
| API integration | `npm test -w @next-stride/server` | Against a real Postgres (`TEST_DATABASE_URL`). See the list below |
| Mobile unit | `npm test -w @next-stride/mobile` | Auth session and API client; location permissions; GPS recording; pause and resume; interrupted-run recovery; offline recording; sync (retry, backoff, duplicate prevention, reconciliation); route visualisation geometry |
| End-to-end | `maestro test apps/mobile/e2e/acceptance.yaml` | The full acceptance flow on a simulator. Requires [Maestro](https://maestro.mobile.dev), the API on :4000, and Metro on :8082 |

The API integration suite covers:

- registration, duplicate email and username (including concurrent signups), and validation;
- login, invalid credentials, and no account enumeration;
- token refresh, rotation, reuse detection, concurrent refresh, and expiry;
- protected endpoints: missing, tampered, wrongly signed and expired tokens;
- profile setup and updates, privacy, email change rules, public profile redaction, and avatar upload;
- logout, the password reset flow, rate limiting, CORS, and security headers;
- runs: ownership isolation, idempotent create and complete (including concurrent), duplicate points, reconciliation, server-side metrics, pauses, pagination, time-zone stats, delete.

The API suite migrates the test database automatically. It refuses to run unless the database name contains `test`, so it can never wipe your development data.

## Acceptance criteria — Phase 2

A user can:

1. **Start a real GPS-tracked run.** Home → Start run, with a permission check and a 3-2-1 countdown.
2. **View live distance and pace.** Elapsed time, distance, current and average pace, current and average speed, and GPS status.
3. **See their route on the map.** The live route follows the runner, with the current position marked.
4. **Pause and resume.** Paused time is excluded, and distance isn't measured across the gap.
5. **Finish the run.** Press and hold, so it can't happen by accident.
6. **Save it to PostgreSQL.** The run is saved on the device first, then uploaded with retries and recomputed on the server.
7. **View it in history.** Activities tab → detail with map, stats and splits.
8. **Reopen the app and still access it.** It is served from the API, or from the device copy when offline.

## Acceptance criteria (Phase 1)

A new user can:

1. **Open NEXT STRIDE.** A branded splash runs while the stored session is restored.
2. **Complete onboarding.** Three screens: Every Run Matters, Progress Every Day, Your Next Achievement. Onboarding is shown once per device.
3. **Register.**
4. **Log in.** Invalid credentials and expired sessions produce clear messages.
5. **Stay authenticated after restarting the app.** The refresh token lives in the iOS Keychain or Android Keystore and is rotated on launch.
6. **Complete their profile.** A 3-step setup; optional personal details are private by default.
7. **Edit their profile.** This includes the photo, username, email (requires the current password) and privacy toggles.
8. **Log out.** This ends the device's session on the server too.

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev:server` | API with hot reload |
| `npm run dev:mobile` | Expo dev server |
| `npm run db:migrate` | Create or apply migrations (`prisma migrate dev`) |
| `npm run db:reset` | Drop and recreate the dev database |
| `npm run build -w @next-stride/server` | Compile the API to `apps/server/dist` |
| `npm run db:deploy -w @next-stride/server` | Apply migrations in production |

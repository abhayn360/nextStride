# Run tracking (Phase 2)

How NEXT STRIDE records a run with GPS, keeps it safe offline, and gets it to the server. It also covers what iOS and Android allow in the background.

## Pipeline

```
expo-location ──► background task / foreground watcher
                        │  (fixes, ~1 per second)
                        ▼
                run-session.ingest ──► SQLite (source of truth, every fix)
                        │                       │
                        ▼                       ▼
            live metrics (shared            run-sync (create → points → complete)
            RunMetricsAccumulator)              │  retried with backoff, idempotent
                        │                       ▼
                   Live run UI            /api/runs …  ──► PostgreSQL
```

| File | Role |
| --- | --- |
| `packages/shared/src/run-metrics.ts` | Haversine, GPS filtering, moving time, pace, speed, splits, calories, GPS signal. Used by both app and server |
| `apps/mobile/src/services/location/location-tracker.ts` | Permissions, background updates, foreground fallback |
| `apps/mobile/src/services/location/location-task.ts` | The `TaskManager` task. Registered from `index.ts` before the app renders, so headless launches work |
| `apps/mobile/src/services/run/run-session.ts` | Start / pause / resume / finish / discard / recover |
| `apps/mobile/src/services/run/sqlite-store.ts` | On-device storage (`expo-sqlite`) |
| `apps/mobile/src/services/run/run-sync.ts` | Upload, retry, reconciliation |
| `apps/server/src/services/run.service.ts` | Idempotent create, deduplicated points, reconciled completion |

## Recording

- **Start:** checks location services, then "While Using" permission, then *precise* location. Approximate location is rejected because it can be kilometres out. Then a 3-2-1 countdown, and `startLocationUpdatesAsync` with:
  - best-for-navigation accuracy at about 1 Hz;
  - `activityType: Fitness`;
  - `pausesUpdatesAutomatically: false`;
  - the iOS blue-pill indicator;
  - the Android foreground-service notification.
- **Every fix** is written to SQLite *before* anything else. Fixes cached from before start or resume are dropped, and duplicates are ignored (unique per run and timestamp).
- **Pause:** location keeps running, so the GPS stays warm and iOS keeps the app alive, but fixes are discarded. Active time stops.
- **Resume:** starts a new `segment`. Distance is never measured across segments, and the map draws them as separate lines.
- **Finish:** press-and-hold for 1.2 s; a tap does nothing. Screen-reader users get a confirmation dialog instead. Runs under 50 m ask whether to save or discard. The run is saved locally as `finished` and shown at once; upload happens separately.
- **GPS signal:**

  | Indicator | Condition |
  | --- | --- |
  | strong | Fix within 8 s, accuracy ≤ 15 m |
  | fair | Accuracy ≤ 35 m |
  | weak | Worse accuracy, or the fix is 8–20 s old |
  | lost | No fix for 20 s |

  The clock keeps running through signal loss. Distance resumes when a plausible fix arrives, because the jump filter only discards impossible speeds.
- **Interrupted runs:** on launch, if a run is still marked recording but location updates are no longer running (for example, the app was killed), it is restored as *paused* at its last fix. Time from the last fix to now is not counted. The run screen reopens with a notice, and the runner can resume or finish.

## Offline and sync

Nothing depends on connectivity while running. Uploads are triggered by:

- finishing a run;
- launching the app;
- returning to the foreground;
- connectivity coming back;
- every 30 s while the app is open;
- every 60 s from the background location task during a run.

Every step is idempotent, so a sync can be interrupted anywhere and re-run:

1. `POST /api/runs` with `clientId = localId`. Retries return the same server run.
2. Points go up in batches of 500. Each batch is marked uploaded only after the server confirms it, and the server also skips duplicate timestamps.
3. `POST /complete` sends `pointCount`. On `409 RUN_POINTS_MISSING` the app marks every point unsent, re-uploads, and retries. This is the reconciliation step.
4. A lost completion response is harmless, because completion is idempotent.

Failures back off exponentially (5 s, 10 s, 20 s, … capped at 10 min). Runs are kept on the device until they reach the server; nothing is dropped. Unsent runs appear in history as "Waiting to upload".

Synced runs keep their points on the device for 30 days, so details still open offline. After that the server copy is used.

Runs are tagged with the account that recorded them. Logging out keeps pending runs on the device, and they upload the next time that account signs in. Logging out mid-run is blocked.

## Maps

- **Rendering:** MapLibre React Native v11, showing the route line, start and finish markers, the current-position marker, a following camera while live, and a fit-to-route overview.
- **Tiles:** `EXPO_PUBLIC_MAP_STYLE_DARK` / `EXPO_PUBLIC_MAP_STYLE_LIGHT`. The defaults are [OpenFreeMap](https://openfreemap.org) `dark` and `positron`: OpenStreetMap data, no API key, good for development.
  - **Don't assume any free provider allows unlimited production traffic.** Check the provider's terms, and expect to use a paid plan or self-host (e.g. OpenFreeMap self-hosted, MapTiler, Stadia) for launch.
  - OSM attribution is shown on the map and is legally required.
- **Fallback:** Expo Go doesn't include MapLibre's native code. The app detects this and draws the route as an SVG sketch instead of crashing. History thumbnails always use the sketch, so lists don't load tiles.

## Platform limitations

### iOS

- **Permission:** tracking continues with the screen locked using only **"While Using the App"**, because the run starts in the foreground and the app declares the `location` background mode. iOS shows the blue location indicator. "Always" isn't requested.
- **Force-quit:** if the user swipes the app away, iOS stops standard location updates and won't relaunch the app for them. The run is recovered as paused at the last fix on the next launch.
- **Low Power Mode:** may reduce GPS frequency.
- **Precise Location:** must be on (Settings → NEXT STRIDE → Location).
- **Expo Go:** has no background location mode for this app. Tracking falls back to foreground-only, and the run screen says so.

### Android

- **Permission:** tracking runs as a **foreground service** with a persistent notification, which keeps working with the screen off. It only needs "While using the app" location, so `ACCESS_BACKGROUND_LOCATION` (and the extra Play Store review it triggers) isn't requested.
- **OEM battery managers:** some manufacturers (Xiaomi, Huawei, Samsung "deep sleep", OnePlus and others) kill foreground services aggressively. Users may need to exclude NEXT STRIDE from battery optimisation; see [dontkillmyapp.com](https://dontkillmyapp.com).
- **Swiping the app away:** if the service survives, recording continues headlessly. If the OS kills it, the run is recovered as paused.
- **Android 14+:** foreground services must declare their type. The `expo-location` config plugin handles this.

### Both

- **Development build required:** the full experience needs a development build (`npx expo run:ios` / `run:android`, or EAS Build), because Expo Go includes neither MapLibre nor this app's background location configuration.
- **Simulators:** iOS simulators deliver one fix for a fixed location. Use `xcrun simctl location booted start …` (or the Simulator's Features → Location → City Run) for continuous movement.
- **Accuracy:** GPS is typically 3–10 m in the open and much worse between tall buildings. Filtering removes noise and jumps, but no filter can fix systematically wrong fixes.

## Voice coach

`services/run/voice-coach.ts` speaks what `VoiceCoach` (`packages/shared`) decides. It is driven by incoming GPS fixes in `runSession.ingest`, not the screen timer, so it keeps working with the screen locked.

- iOS needs the `audio` background mode (set in `app.json`). Speech uses a system-managed audio session so it mixes with music.
- iOS physical devices stay silent in silent mode, according to the `expo-speech` docs.
- A zone alert needs 45 seconds above the chosen zone, then waits at least 3 minutes before repeating.
- After a run is restored, already-covered kilometres aren't repeated and the next split is left out, because its start time is unknown.

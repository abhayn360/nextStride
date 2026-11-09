import * as Crypto from 'expo-crypto';

import { queryClient } from '@/lib/query-client';
import { runsApi } from '@/services';
import { createLocationTracker } from '@/services/location/location-tracker';
import { useAuthStore } from '@/store/auth.store';
import { useRunStore } from '@/store/run.store';

import { createRunSession } from './run-session';
import { createRunSync } from './run-sync';
import { sqliteRunStore } from './sqlite-store';
import { createRunVoiceCoach } from './voice-coach';

/** Composition root for run recording and syncing. Safe to import from the headless location task. */
const getUserId = () => useAuthStore.getState().user?.id ?? null;
const now = () => Date.now();

function notifyRunsChanged() {
  useRunStore.setState((state) => ({ syncVersion: state.syncVersion + 1 }));
  void queryClient.invalidateQueries({ queryKey: ['runs'] });
}

export const runSync = createRunSync({
  store: sqliteRunStore,
  api: runsApi,
  getUserId,
  now,
  onSynced: notifyRunsChanged,
});

const BACKGROUND_SYNC_INTERVAL_MS = 60_000;
let lastBackgroundSync = 0;

const tracker = createLocationTracker((locations) => {
  void runSession.ingest(locations);
});

export const runSession = createRunSession({
  store: sqliteRunStore,
  tracker,
  now,
  uuid: () => Crypto.randomUUID(),
  getUserId,
  coach: createRunVoiceCoach(),
  ui: useRunStore.getState(),
  onFinished: () => {
    notifyRunsChanged();
    void runSync.syncAll({ force: true });
  },
  // Stream points to the server periodically during the run (also from the background task).
  onPointsRecorded: () => {
    if (now() - lastBackgroundSync < BACKGROUND_SYNC_INTERVAL_MS) return;
    lastBackgroundSync = now();
    void runSync.syncAll();
  },
});

export { sqliteRunStore as runStore };
export type { LocalRun } from './local-store';

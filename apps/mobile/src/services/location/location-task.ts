import * as TaskManager from 'expo-task-manager';

import { runSession } from '@/services/run';

import { RUN_LOCATION_TASK, type RawLocation } from './location-tracker';

/**
 * Must be defined in the global scope at app start (imported from the entry file),
 * because the OS can wake the app headlessly to deliver locations.
 */
TaskManager.defineTask<{ locations: RawLocation[] }>(RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await runSession.ingest(data.locations);
});

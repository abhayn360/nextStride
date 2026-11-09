import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { palette } from '@/theme/colors';

export const RUN_LOCATION_TASK = 'next-stride.run-location';

export type PermissionResult =
  | { granted: true; precise: boolean }
  | { granted: false; reason: 'services-disabled' | 'denied' | 'blocked' };

/** 'background' keeps recording with the screen locked; 'foreground' only while the app is open. */
export type TrackingMode = 'background' | 'foreground';

export interface RawLocation {
  coords: { latitude: number; longitude: number; altitude: number | null; accuracy: number | null };
  timestamp: number;
}

export interface LocationTracker {
  ensurePermission(): Promise<PermissionResult>;
  start(): Promise<TrackingMode>;
  stop(): Promise<void>;
  isTracking(): Promise<boolean>;
}

/**
 * Tuned for running: best accuracy, ~1 fix per second, never auto-paused by iOS.
 * On Android a foreground service (persistent notification) keeps tracking alive
 * with the screen off; on iOS the `location` background mode does the same and
 * shows the blue status-bar indicator.
 */
const TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  activityType: Location.ActivityType.Fitness,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'NEXT STRIDE is tracking your run',
    notificationBody: 'Open the app to pause or finish.',
    notificationColor: palette.electricLime,
    killServiceOnDestroy: false,
  },
};

/**
 * Only "While Using" permission is requested: with the background mode (iOS)
 * or foreground service (Android) a run started in the app keeps recording when
 * the screen locks, without asking for "Always" access.
 */
export async function ensureLocationPermission(): Promise<PermissionResult> {
  if (!(await Location.hasServicesEnabledAsync())) return { granted: false, reason: 'services-disabled' };

  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { granted: false, reason: permission.canAskAgain ? 'denied' : 'blocked' };

  const precise =
    Platform.OS === 'ios' ? permission.ios?.accuracy !== 'reduced' : permission.android?.accuracy !== 'coarse';
  return { granted: true, precise };
}

export function createLocationTracker(onLocations: (locations: RawLocation[]) => void): LocationTracker {
  let watcher: Location.LocationSubscription | null = null;

  return {
    ensurePermission: ensureLocationPermission,

    async start() {
      try {
        await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, TASK_OPTIONS);
        return 'background';
      } catch {
        // Background updates are unavailable (e.g. Expo Go has no background mode).
        // Keep recording while the app is open rather than failing the run.
        watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          (location) => onLocations([location]),
        );
        return 'foreground';
      }
    },

    async stop() {
      watcher?.remove();
      watcher = null;
      if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK).catch(() => false)) {
        await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
      }
    },

    async isTracking() {
      if (watcher) return true;
      return Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK).catch(() => false);
    },
  };
}

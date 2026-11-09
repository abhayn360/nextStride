import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { createLocationTracker, ensureLocationPermission, RUN_LOCATION_TASK } from '../location-tracker';

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { Fitness: 3 },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const mocked = Location as jest.Mocked<typeof Location>;
const response = (granted: boolean, canAskAgain = true, accuracy: 'full' | 'reduced' = 'full') =>
  ({ granted, canAskAgain, status: granted ? 'granted' : 'denied', expires: 'never', ios: { scope: 'whenInUse', accuracy } }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  mocked.hasServicesEnabledAsync.mockResolvedValue(true);
});

describe('ensureLocationPermission', () => {
  it('asks for permission when it has not been granted yet', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response(false));
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(response(true));
    await expect(ensureLocationPermission()).resolves.toEqual({ granted: true, precise: true });
    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('reports a denial that can be asked again', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response(false));
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(response(false, true));
    await expect(ensureLocationPermission()).resolves.toEqual({ granted: false, reason: 'denied' });
  });

  it('reports a permanent denial (must go to Settings) without prompting', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response(false, false));
    await expect(ensureLocationPermission()).resolves.toEqual({ granted: false, reason: 'blocked' });
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('detects location services being switched off', async () => {
    mocked.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(ensureLocationPermission()).resolves.toEqual({ granted: false, reason: 'services-disabled' });
  });

  it('flags approximate-only location, which is useless for runs', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValue(response(true, true, 'reduced'));
    await expect(ensureLocationPermission()).resolves.toEqual({ granted: true, precise: false });
  });
});

describe('createLocationTracker', () => {
  it('uses background location updates when available', async () => {
    mocked.startLocationUpdatesAsync.mockResolvedValue();
    const tracker = createLocationTracker(jest.fn());
    await expect(tracker.start()).resolves.toBe('background');
    expect(mocked.startLocationUpdatesAsync).toHaveBeenCalledWith(
      RUN_LOCATION_TASK,
      expect.objectContaining({ pausesUpdatesAutomatically: false, foregroundService: expect.any(Object) }),
    );
  });

  it('falls back to foreground tracking when background mode is unavailable (e.g. Expo Go)', async () => {
    mocked.startLocationUpdatesAsync.mockRejectedValue(new Error('LocationUpdatesUnavailable'));
    let deliver: ((location: unknown) => void) | undefined;
    const remove = jest.fn();
    mocked.watchPositionAsync.mockImplementation(async (_options, callback) => {
      deliver = callback as (location: unknown) => void;
      return { remove } as never;
    });
    const onLocations = jest.fn();
    const tracker = createLocationTracker(onLocations);

    await expect(tracker.start()).resolves.toBe('foreground');
    const fix = { coords: { latitude: 1, longitude: 2, altitude: null, accuracy: 4 }, timestamp: 1 };
    deliver!(fix);
    expect(onLocations).toHaveBeenCalledWith([fix]);
    await expect(tracker.isTracking()).resolves.toBe(true);

    mocked.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await tracker.stop();
    expect(remove).toHaveBeenCalled();
  });
});

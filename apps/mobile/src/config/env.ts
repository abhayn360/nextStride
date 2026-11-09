import Constants from 'expo-constants';
import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

interface SourceCodeModule extends TurboModule {
  getConstants(): { scriptURL: string };
}

/**
 * Host of the Metro server this JS bundle was loaded from, if any.
 * - Expo Go / expo-dev-client report it as `hostUri` (e.g. "192.168.1.4:8082").
 * - Plain debug builds (`expo run:android|ios` without expo-dev-client) don't, so
 *   fall back to the bundle URL itself. On a USB-connected Android phone that is
 *   "localhost" via `adb reverse`, on the emulator "10.0.2.2", on Wi-Fi the LAN IP.
 * Whatever host reached Metro also reaches the API on the same machine.
 */
function devServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(':')[0] ?? null;

  try {
    const scriptURL = TurboModuleRegistry.get<SourceCodeModule>('SourceCode')?.getConstants().scriptURL;
    const match = scriptURL ? /^https?:\/\/([^/:]+)/.exec(scriptURL) : null;
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * API base URL.
 * 1. EXPO_PUBLIC_API_URL if set (required for production builds).
 * 2. Otherwise, in development, the machine running Metro on port 4000. When that
 *    host is "localhost" on a USB-connected Android phone, forward the port too:
 *    `npm run reverse` (adb reverse tcp:4000 tcp:4000).
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const devHost = __DEV__ ? devServerHost() : null;
  if (devHost) return `http://${devHost}:4000`;

  // The Android emulator reaches the host machine through 10.0.2.2.
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const config = {
  apiUrl: resolveApiUrl(),
  /**
   * MapLibre style URLs. Defaults are OpenFreeMap (OpenStreetMap data, no API key),
   * fine for development. Check the provider's terms before production use and
   * point these at a provider/plan that fits your traffic.
   */
  mapStyle: {
    dark: process.env.EXPO_PUBLIC_MAP_STYLE_DARK ?? 'https://tiles.openfreemap.org/styles/dark',
    light: process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT ?? 'https://tiles.openfreemap.org/styles/positron',
  },
  requestTimeoutMs: 15_000,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;

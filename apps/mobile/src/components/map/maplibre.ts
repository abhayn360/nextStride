import { TurboModuleRegistry } from 'react-native';

type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

let cached: MapLibreModule | null | undefined;

/**
 * MapLibre is a native module: it exists in development/production builds but
 * not in Expo Go. Importing it eagerly would crash there, so it is loaded only
 * when the native side is present. Returns null otherwise (callers fall back to
 * an SVG route sketch).
 */
export function getMapLibre(): MapLibreModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = TurboModuleRegistry.get('MLRNMapViewModule')
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native import
        (require('@maplibre/maplibre-react-native') as MapLibreModule)
      : null;
  } catch {
    cached = null;
  }
  return cached;
}

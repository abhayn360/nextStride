export type LngLat = [number, number];
export type Route = LngLat[][];

/** [west, south, east, north] */
export type Bounds = [number, number, number, number];

export function routeIsEmpty(route: Route): boolean {
  return route.every((line) => line.length === 0);
}

/** Bounding box of the route, padded so short routes don't zoom in absurdly far. */
export function routeBounds(route: Route, minSpanDegrees = 0.002): Bounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const line of route) {
    for (const [lng, lat] of line) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  if (!Number.isFinite(west)) return null;
  const padLng = Math.max(0, (minSpanDegrees - (east - west)) / 2);
  const padLat = Math.max(0, (minSpanDegrees - (north - south)) / 2);
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}

/** GeoJSON for the route line (one MultiLineString, segments split at pauses). */
export function routeFeature(route: Route): GeoJSON.Feature<GeoJSON.MultiLineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'MultiLineString', coordinates: route.filter((line) => line.length > 1) },
  };
}

/** Start/finish markers. */
export function endpointsFeature(route: Route, includeFinish: boolean): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const lines = route.filter((line) => line.length > 0);
  const start = lines[0]?.[0];
  const finish = lines.at(-1)?.at(-1);
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (start) features.push({ type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: start } });
  if (finish && includeFinish && lines.flat().length > 1) {
    features.push({ type: 'Feature', properties: { kind: 'finish' }, geometry: { type: 'Point', coordinates: finish } });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Projects the route into an SVG box (equirectangular, corrected for latitude),
 * preserving aspect ratio. Used for thumbnails and the no-map fallback.
 */
export function projectRoute(route: Route, width: number, height: number, padding = 8) {
  const bounds = routeBounds(route, 0.0005);
  if (!bounds) return { lines: [] as { x: number; y: number }[][], project: null };
  const [west, south, east, north] = bounds;
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = (east - west) * k;
  const spanY = north - south;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const project = ([lng, lat]: LngLat) => ({ x: offsetX + (lng - west) * k * scale, y: offsetY + (north - lat) * scale });
  return { lines: route.map((line) => line.map(project)), project };
}

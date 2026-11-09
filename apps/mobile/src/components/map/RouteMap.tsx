import { type StyleProp, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { config } from '@/config/env';
import { useTheme, useThemedStyles } from '@/theme';

import { getMapLibre } from './maplibre';
import { endpointsFeature, type LngLat, type Route, routeBounds, routeFeature, routeIsEmpty } from './route-geometry';
import { RouteSketch } from './RouteSketch';

export interface RouteMapProps {
  route: Route;
  /** Current position (live tracking). */
  current?: LngLat | null;
  /** Live mode: follow the current position. Otherwise frame the whole route. */
  follow?: boolean;
  /** Show the finish marker (completed runs). */
  finished?: boolean;
  interactive?: boolean;
  /** Extra space kept clear (e.g. under overlaid panels), in points. */
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FOLLOW_ZOOM = 16;

/**
 * Route map backed by MapLibre with OpenStreetMap-based tiles (style URL is
 * configurable). Falls back to an SVG sketch when MapLibre isn't available.
 */
export function RouteMap({
  route,
  current,
  follow = false,
  finished = false,
  interactive = true,
  padding,
  style,
  testID,
}: RouteMapProps) {
  const theme = useTheme();
  const MapLibre = getMapLibre();
  const styles = useThemedStyles((t) => ({
    root: { overflow: 'hidden', backgroundColor: t.colors.backgroundSecondary },
    fallbackNote: { position: 'absolute', left: t.spacing.sm, bottom: t.spacing.sm },
  }));

  if (!MapLibre) {
    return (
      <View style={[styles.root, style]} testID={testID}>
        <RouteSketch route={route} current={current} showFinish={finished} framed />
        <Text variant="caption" tone="muted" style={[styles.fallbackNote, { bottom: (padding?.bottom ?? 0) + 12 }]}>
          Map tiles need the NEXT STRIDE app build
        </Text>
      </View>
    );
  }

  const { Map, Camera, GeoJSONSource, Layer } = MapLibre;
  const viewPadding = { top: 48, bottom: 48, left: 40, right: 40, ...padding };
  const bounds = routeBounds(current ? [...route, [current]] : route);
  const cameraProps =
    follow && current
      ? { center: current, zoom: FOLLOW_ZOOM, duration: 800, easing: 'ease' as const, padding: viewPadding }
      : bounds
        ? { bounds, padding: viewPadding, duration: 0 }
        : { zoom: 1, duration: 0 };

  return (
    <View style={[styles.root, style]} testID={testID}>
      <Map
        style={{ flex: 1 }}
        mapStyle={theme.mode === 'dark' ? config.mapStyle.dark : config.mapStyle.light}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        logo={false}
        compass={false}
        scaleBar={false}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={false}
        touchPitch={false}
        accessibilityLabel={finished ? 'Map of your route' : 'Live map'}
      >
        <Camera {...cameraProps} />
        {!routeIsEmpty(route) ? (
          <GeoJSONSource id="route" data={routeFeature(route)}>
            <Layer
              type="line"
              id="route-casing"
              style={{ lineColor: theme.colors.background, lineWidth: 8, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.6 }}
            />
            <Layer
              type="line"
              id="route-line"
              style={{ lineColor: theme.colors.accent, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        <GeoJSONSource id="endpoints" data={endpointsFeature(route, finished)}>
          <Layer
            type="circle"
            id="endpoint-markers"
            style={{
              circleRadius: 7,
              circleColor: ['match', ['get', 'kind'], 'start', theme.colors.success, theme.colors.textPrimary],
              circleStrokeWidth: 3,
              circleStrokeColor: theme.colors.background,
            }}
          />
        </GeoJSONSource>
        {current ? (
          <GeoJSONSource id="current" data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: current } }}>
            <Layer type="circle" id="current-halo" style={{ circleRadius: 16, circleColor: theme.colors.accent, circleOpacity: 0.2 }} />
            <Layer
              type="circle"
              id="current-dot"
              style={{ circleRadius: 7, circleColor: theme.colors.accent, circleStrokeWidth: 3, circleStrokeColor: theme.colors.background }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
    </View>
  );
}

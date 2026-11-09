import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { useTheme, useThemedStyles } from '@/theme';

import { projectRoute, type LngLat, type Route } from './route-geometry';

export interface RouteSketchProps {
  route: Route;
  /** Live position marker. */
  current?: LngLat | null;
  showFinish?: boolean;
  strokeWidth?: number;
  /** Background panel; off for small thumbnails on cards. */
  framed?: boolean;
}

/**
 * Tile-free route drawing: list thumbnails, and the map fallback when MapLibre's
 * native module isn't available (Expo Go).
 */
export function RouteSketch({ route, current, showFinish = true, strokeWidth = 3, framed = false }: RouteSketchProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, overflow: 'hidden' },
    framed: { backgroundColor: t.colors.backgroundSecondary },
  }));

  const withCurrent: Route = current ? [...route, [current]] : route;
  const { lines, project } = size.width > 0 ? projectRoute(withCurrent, size.width, size.height, 12) : { lines: [], project: null };
  const drawn = current ? lines.slice(0, -1) : lines;
  const start = drawn.find((line) => line.length > 0)?.[0];
  const finish = drawn.filter((line) => line.length > 0).at(-1)?.at(-1);
  const here = current && project ? project(current) : null;

  return (
    <View
      style={[styles.root, framed && styles.framed]}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      accessibilityRole="image"
      accessibilityLabel="Route outline"
    >
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height}>
          {drawn.map((line, index) =>
            line.length > 1 ? (
              <Polyline
                key={index}
                points={line.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={theme.colors.accent}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}
          {start ? <Circle cx={start.x} cy={start.y} r={strokeWidth + 1.5} fill={theme.colors.success} stroke={theme.colors.background} strokeWidth={1.5} /> : null}
          {showFinish && finish && finish !== start ? (
            <Circle cx={finish.x} cy={finish.y} r={strokeWidth + 1.5} fill={theme.colors.textPrimary} stroke={theme.colors.background} strokeWidth={1.5} />
          ) : null}
          {here ? (
            <>
              <Circle cx={here.x} cy={here.y} r={12} fill={theme.colors.accentSubtle} />
              <Circle cx={here.x} cy={here.y} r={6} fill={theme.colors.accent} stroke={theme.colors.background} strokeWidth={2} />
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

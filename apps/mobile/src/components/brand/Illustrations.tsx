import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface IllustrationProps {
  size: number;
  /** Plays the reveal animation when true (the page is in view). */
  active: boolean;
}

function useReveal(active: boolean, duration = 1100, delay = 150) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (active) {
      progress.set(0);
      progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) })));
    }
  }, [active, delay, duration, progress]);
  return progress;
}

/** Decorative concentric rings — a quiet brand backdrop behind hero content. */
export function BrandRings({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Backdrop size={280} />
    </Svg>
  );
}

/** Faint concentric rings shared by all three scenes. */
function Backdrop({ size }: { size: number }) {
  const { colors } = useTheme();
  const c = size / 2;
  return (
    <G>
      {[0.46, 0.34, 0.22].map((r) => (
        <Circle key={r} cx={c} cy={c} r={size * r} stroke={colors.border} strokeWidth={1} fill="none" />
      ))}
    </G>
  );
}

/** 1 — Every Run Matters: a route draws itself from start to finish. */
export function RouteIllustration({ size, active }: IllustrationProps) {
  const { colors } = useTheme();
  const progress = useReveal(active, 1400);
  const ROUTE_LENGTH = 560;
  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LENGTH * (1 - progress.value) }));
  const pinProps = useAnimatedProps(() => ({ opacity: progress.value > 0.95 ? 1 : 0 }));

  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Backdrop size={280} />
      <Path
        d="M62 206 C 86 150, 128 186, 140 140 S 176 74, 218 82"
        stroke={colors.borderStrong}
        strokeWidth={2}
        strokeDasharray="2 8"
        strokeLinecap="round"
        fill="none"
      />
      <AnimatedPath
        d="M62 206 C 86 150, 128 186, 140 140 S 176 74, 218 82"
        stroke={colors.accent}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${ROUTE_LENGTH} ${ROUTE_LENGTH}`}
        animatedProps={routeProps}
      />
      <Circle cx={62} cy={206} r={9} fill={colors.background} stroke={colors.textPrimary} strokeWidth={3} />
      <AnimatedCircle cx={218} cy={82} r={13} fill={colors.accent} animatedProps={pinProps} />
      <AnimatedCircle cx={218} cy={82} r={5} fill={colors.onAccent} animatedProps={pinProps} />
    </Svg>
  );
}

/** 2 — Progress Every Day: a week of bars rising, today highlighted. */
export function ProgressIllustration({ size, active }: IllustrationProps) {
  const { colors } = useTheme();
  const progress = useReveal(active, 900);
  const heights = [56, 84, 66, 104, 90, 122, 150];
  const barWidth = 18;
  const gap = 12;
  const left = (280 - (heights.length * barWidth + (heights.length - 1) * gap)) / 2;
  const baseline = 206;

  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Backdrop size={280} />
      <Line x1={left - 8} y1={baseline + 10} x2={280 - left + 8} y2={baseline + 10} stroke={colors.border} strokeWidth={2} />
      {heights.map((height, index) => (
        <Bar
          key={index}
          x={left + index * (barWidth + gap)}
          baseline={baseline}
          width={barWidth}
          height={height}
          progress={progress}
          delay={index * 0.06}
          color={index === heights.length - 1 ? colors.accent : colors.borderStrong}
        />
      ))}
    </Svg>
  );
}

function Bar({
  x,
  baseline,
  width,
  height,
  progress,
  delay,
  color,
}: {
  x: number;
  baseline: number;
  width: number;
  height: number;
  progress: ReturnType<typeof useSharedValue<number>>;
  delay: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const local = Math.min(1, Math.max(0, (progress.value - delay) / (1 - delay)));
    const h = Math.max(width, height * local);
    return { y: baseline - h, height: h };
  });
  return <AnimatedRect x={x} width={width} rx={width / 2} fill={color} animatedProps={animatedProps} />;
}

/** 3 — Your Next Achievement: an XP ring fills around a level badge. */
export function AchievementIllustration({ size, active }: IllustrationProps) {
  const { colors } = useTheme();
  const progress = useReveal(active, 1300);
  const r = 78;
  const circumference = 2 * Math.PI * r;
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - 0.72 * progress.value) }));

  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Backdrop size={280} />
      <Circle cx={140} cy={140} r={r} stroke={colors.border} strokeWidth={10} fill="none" />
      <AnimatedCircle
        cx={140}
        cy={140}
        r={r}
        stroke={colors.accent}
        strokeWidth={10}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={ringProps}
        transform="rotate(-90 140 140)"
      />
      {/* Hexagonal badge with the brand chevron */}
      <Path d="M140 92 L181 116 L181 164 L140 188 L99 164 L99 116 Z" fill={colors.card} stroke={colors.borderStrong} strokeWidth={2} />
      <Path d="M124 118h11l17 22-17 22h-11l17-22z" fill={colors.accent} />
      {/* Sparkles */}
      <Path d="M222 70 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill={colors.accent} opacity={0.8} />
      <Path d="M58 196 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill={colors.textSecondary} opacity={0.6} />
    </Svg>
  );
}

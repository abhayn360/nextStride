import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { motion, useTheme, useThemedStyles } from '@/theme';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export interface ProgressBarProps {
  /** 0–1 */
  progress: number;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({ progress, height = 6, accessibilityLabel = 'Progress' }: ProgressBarProps) {
  const value = useSharedValue(0);
  const styles = useThemedStyles((t) => ({
    track: { width: '100%', backgroundColor: t.colors.border, borderRadius: t.radius.pill, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: t.colors.accent, borderRadius: t.radius.pill },
  }));

  useEffect(() => {
    value.set(withTiming(clamp(progress), { duration: motion.duration.slow, easing: motion.easing.standard }));
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={[styles.track, { height }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(progress) * 100) }}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0–1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  children,
  accessibilityLabel = 'Progress',
}: ProgressRingProps) {
  const theme = useTheme();
  const value = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    value.set(withTiming(clamp(progress), { duration: motion.duration.reveal, easing: motion.easing.decelerate }));
  }, [progress, value]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - value.value) }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(progress) * 100) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.border} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

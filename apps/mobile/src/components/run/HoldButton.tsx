import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { type ColorTokens, useTheme, useThemedStyles } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const HOLD_MS = 1200;

export interface HoldButtonProps {
  icon: IconName;
  label: string;
  onComplete: () => void;
  /** Screen readers can't press-and-hold, so they get this instead (e.g. a confirmation dialog). */
  onAccessibleActivate: () => void;
  color?: keyof ColorTokens;
  size?: number;
  testID?: string;
}

/**
 * Press and hold to confirm — used for Finish so a stray tap (or a pocket)
 * can never end a run. A ring fills while held; releasing early cancels.
 */
export function HoldButton({ icon, label, onComplete, onAccessibleActivate, color = 'textPrimary', size = 76, testID }: HoldButtonProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const styles = useThemedStyles((t) => ({
    root: { alignItems: 'center', gap: t.spacing.xs },
    button: { alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.pill, backgroundColor: t.colors.elevated, borderWidth: 1, borderColor: t.colors.border },
  }));

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  const begin = () => {
    progress.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      timer.current = null;
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }, HOLD_MS);
  };

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: 200 }));
  };

  return (
    <View style={styles.root}>
      <Pressable
        testID={testID}
        onPressIn={begin}
        onPressOut={cancel}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Press and hold to confirm"
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onAccessibleActivate();
        }}
        style={[styles.button, { width: size, height: size }]}
      >
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.colors[color]}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={ringProps}
          />
        </Svg>
        <Icon name={icon} size={26} color={color} />
      </Pressable>
      <Text variant="caption" tone="secondary">
        Hold to {label.toLowerCase()}
      </Text>
    </View>
  );
}

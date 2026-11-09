import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark, TAGLINE, Wordmark } from '@/components/brand/Logo';
import { Button, Text } from '@/components/ui';
import { session } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { motion, useThemedStyles } from '@/theme';

const MIN_DISPLAY_MS = 1300;

/**
 * Branded launch screen shown while fonts, preferences and the stored session
 * are restored. Picks up seamlessly from the native splash (same background + mark).
 */
export function BrandSplash({ onMinimumElapsed }: { onMinimumElapsed: () => void }) {
  const insets = useSafeAreaInsets();
  const restoreError = useAuthStore((state) => state.restoreError);
  const mark = useSharedValue(0);
  const text = useSharedValue(0);

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background, alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center', gap: t.spacing.xl },
    text: { alignItems: 'center', gap: t.spacing.xs },
    error: {
      position: 'absolute',
      left: t.spacing.xl,
      right: t.spacing.xl,
      gap: t.spacing.sm,
      alignItems: 'stretch',
    },
  }));

  useEffect(() => {
    mark.set(withTiming(1, { duration: motion.duration.reveal, easing: Easing.out(Easing.exp) }));
    text.set(withDelay(250, withTiming(1, { duration: motion.duration.reveal, easing: motion.easing.decelerate })));
    const timer = setTimeout(onMinimumElapsed, MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [mark, text, onMinimumElapsed]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ translateX: (1 - mark.value) * -24 }, { scale: 0.9 + mark.value * 0.1 }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 8 }] }));

  return (
    <View style={styles.root} testID="brand-splash">
      <View style={styles.center}>
        <Animated.View style={markStyle}>
          <LogoMark size={84} />
        </Animated.View>
        <Animated.View style={[styles.text, textStyle]}>
          <Wordmark size="lg" />
          <Text variant="body" tone="secondary">
            {TAGLINE}
          </Text>
        </Animated.View>
      </View>

      {restoreError ? (
        <Animated.View entering={FadeIn.duration(250)} style={[styles.error, { bottom: Math.max(insets.bottom, 24) + 8 }]}>
          <Text variant="body" tone="secondary" align="center">
            {restoreError}
          </Text>
          <Button label="Try again" onPress={() => void session.restore()} testID="splash-retry" />
          <Button label="Sign out" variant="text" onPress={() => void session.signOut()} />
        </Animated.View>
      ) : null}
    </View>
  );
}

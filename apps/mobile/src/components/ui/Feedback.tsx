import { useEffect } from 'react';
import { ActivityIndicator, type DimensionValue, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { type RadiusToken, useTheme, useThemedStyles } from '@/theme';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/* ----------------------------------------------------------------------------
 * Skeleton — placeholder shapes while content loads.
 * ------------------------------------------------------------------------- */

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: RadiusToken;
}

export function Skeleton({ width = '100%', height = 16, radius = 'button' }: SkeletonProps) {
  const theme = useTheme();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: theme.radius[radius], backgroundColor: theme.colors.skeleton }, style]}
    />
  );
}

/* ----------------------------------------------------------------------------
 * LoadingState — full-area spinner with an optional label.
 * ------------------------------------------------------------------------- */

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, padding: t.spacing.xl },
  }));
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
      {label ? (
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------------------
 * EmptyState / ErrorState — centred message with an optional action.
 * ------------------------------------------------------------------------- */

interface StateMessageProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}

function StateMessage({ icon, title, message, actionLabel, onAction, tone = 'neutral' }: StateMessageProps) {
  const styles = useThemedStyles((t) => ({
    root: { alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, paddingVertical: t.spacing['2xl'], paddingHorizontal: t.spacing.xl },
    icon: {
      width: 56,
      height: 56,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.xs,
      backgroundColor: tone === 'error' ? t.colors.errorSubtle : t.colors.accentSubtle,
    },
    action: { marginTop: t.spacing.sm, alignSelf: 'stretch' },
  }));
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.root}>
      <View style={styles.icon}>
        <Icon name={icon} size={24} color={tone === 'error' ? 'errorText' : 'accentText'} />
      </View>
      <Text variant="cardTitle" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant={tone === 'error' ? 'secondary' : 'primary'} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export function EmptyState(props: Omit<StateMessageProps, 'tone'>) {
  return <StateMessage {...props} />;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <StateMessage
      icon="alert-triangle"
      tone="error"
      title={title}
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

/* ----------------------------------------------------------------------------
 * Banner — inline, non-blocking message (form errors, notices).
 * ------------------------------------------------------------------------- */

export function Banner({ tone = 'error', message }: { tone?: 'error' | 'info' | 'success'; message: string }) {
  const styles = useThemedStyles((t) => ({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.input,
      borderWidth: 1,
    },
    error: { backgroundColor: t.colors.errorSubtle, borderColor: t.colors.errorSubtle },
    info: { backgroundColor: t.colors.backgroundSecondary, borderColor: t.colors.border },
    success: { backgroundColor: t.colors.accentSubtle, borderColor: t.colors.accentSubtle },
    text: { flex: 1 },
  }));
  const icon: IconName = tone === 'error' ? 'alert-circle' : tone === 'success' ? 'check-circle' : 'info';
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.root, styles[tone]]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name={icon} size={18} color={tone === 'error' ? 'errorText' : tone === 'success' ? 'accentText' : 'info'} />
      <Text variant="body" tone={tone === 'error' ? 'error' : 'primary'} style={styles.text}>
        {message}
      </Text>
    </Animated.View>
  );
}

import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useTheme, useThemedStyles } from '@/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    base: {
      minHeight: 44,
      borderRadius: t.radius.button,
      paddingHorizontal: t.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: t.spacing.xs,
    },
    lg: { height: 54 },
    md: { height: 44, paddingHorizontal: t.spacing.md },
    primary: { backgroundColor: t.colors.accent },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.colors.borderStrong },
    text: { backgroundColor: 'transparent', paddingHorizontal: t.spacing.xs, minHeight: 40, height: 40 },
    danger: { backgroundColor: t.colors.errorSubtle },
    disabled: { opacity: 0.45 },
    fullWidth: { alignSelf: 'stretch' },
    content: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  }));

  const contentColor =
    variant === 'primary' ? 'onAccent' : variant === 'text' ? 'accentText' : variant === 'danger' ? 'errorText' : 'textPrimary';
  const textTone = variant === 'primary' ? 'onAccent' : variant === 'text' ? 'accent' : variant === 'danger' ? 'error' : 'primary';
  const inactive = disabled || loading;

  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={variant === 'text' ? 8 : undefined}
      onPress={() => {
        if (variant === 'primary' && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        styles.base,
        variant !== 'text' && styles[size],
        styles[variant],
        disabled && !loading && styles.disabled,
        fullWidth && variant !== 'text' && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors[contentColor]} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <Icon name={leftIcon} size={18} color={contentColor} /> : null}
          <Text variant="button" tone={textTone}>
            {label}
          </Text>
          {rightIcon ? <Icon name={rightIcon} size={18} color={contentColor} /> : null}
        </View>
      )}
    </ScalePressable>
  );
}

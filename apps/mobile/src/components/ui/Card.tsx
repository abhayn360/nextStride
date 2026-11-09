import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useThemedStyles } from '@/theme';

import { ScalePressable } from './Pressable';

export interface CardProps {
  children: ReactNode;
  /** `large` uses the 20px radius for hero cards. */
  size?: 'default' | 'large';
  variant?: 'filled' | 'outline' | 'accent';
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  size = 'default',
  variant = 'filled',
  padded = true,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: CardProps) {
  const styles = useThemedStyles((t) => ({
    base: { borderRadius: t.radius.card, borderWidth: 1, overflow: 'hidden' },
    large: { borderRadius: t.radius.cardLarge },
    padded: { padding: t.spacing.lg },
    filled: { backgroundColor: t.colors.card, borderColor: t.mode === 'dark' ? t.colors.card : t.colors.border, ...t.shadows.sm },
    outline: { backgroundColor: 'transparent', borderColor: t.colors.border },
    accent: { backgroundColor: t.colors.accent, borderColor: t.colors.accent },
  }));

  const composed = [styles.base, size === 'large' && styles.large, padded && styles.padded, styles[variant], style];

  if (onPress) {
    return (
      <ScalePressable
        testID={testID}
        onPress={onPress}
        pressedScale={0.985}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={composed}
      >
        {children}
      </ScalePressable>
    );
  }
  return (
    <View testID={testID} style={composed}>
      {children}
    </View>
  );
}

import { type ColorTokens, useThemedStyles } from '@/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'ghost' | 'filled';
  color?: keyof ColorTokens;
  size?: number;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'ghost',
  color = 'textPrimary',
  size = 40,
  testID,
}: IconButtonProps) {
  const styles = useThemedStyles((t) => ({
    base: { alignItems: 'center', justifyContent: 'center', borderRadius: t.radius.pill },
    filled: { backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.border },
  }));
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={[styles.base, { width: size, height: size }, variant === 'filled' && styles.filled]}
    >
      <Icon name={icon} size={20} color={color} />
    </ScalePressable>
  );
}

import { View } from 'react-native';

import { useThemedStyles } from '@/theme';

import { Icon } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

/** Pill-shaped selectable option. Static (no onPress) chips render as tags. */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const styles = useThemedStyles((t) => ({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xxs,
      minHeight: 40,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.backgroundSecondary,
    },
    tag: { minHeight: 30, paddingHorizontal: t.spacing.sm },
    selected: { borderColor: t.colors.accent, backgroundColor: t.colors.accentSubtle },
  }));

  const body = (
    <>
      {selected && onPress ? <Icon name="check" size={14} color="accentText" /> : null}
      <Text variant={onPress ? 'label' : 'caption'} tone={selected ? 'accent' : onPress ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </>
  );

  if (!onPress) return <View style={[styles.base, styles.tag, selected && styles.selected]}>{body}</View>;
  return (
    <ScalePressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[styles.base, selected && styles.selected]}
    >
      {body}
    </ScalePressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles((t) => ({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs } }));
  return <View style={styles.row}>{children}</View>;
}

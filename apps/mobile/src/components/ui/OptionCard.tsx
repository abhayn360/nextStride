import { View } from 'react-native';

import { useThemedStyles } from '@/theme';

import { ScalePressable } from './Pressable';
import { Text } from './Text';

export interface OptionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** Single-choice option with a radio indicator (running experience, etc.). */
export function OptionCard({ title, description, selected, onPress, testID }: OptionCardProps) {
  const styles = useThemedStyles((t) => ({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: t.radius.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.backgroundSecondary,
    },
    selected: { borderColor: t.colors.accent, backgroundColor: t.colors.accentSubtle },
    text: { flex: 1, gap: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: t.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: { borderColor: t.colors.accent },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.accent },
  }));

  return (
    <ScalePressable
      testID={testID}
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={[styles.base, selected && styles.selected]}
    >
      <View style={styles.text}>
        <Text variant="cardTitle">{title}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.dot} /> : null}</View>
    </ScalePressable>
  );
}

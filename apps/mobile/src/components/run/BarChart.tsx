import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useThemedStyles } from '@/theme';

export interface Bar {
  label: string;
  value: number;
  /** Highlighted (e.g. today / this week). */
  current?: boolean;
  /** Spoken value for screen readers, e.g. "3.2 km". */
  accessibilityValue: string;
}

/** Minimal bar chart for weekly/monthly distance summaries. */
export function BarChart({ bars, height = 96 }: { bars: Bar[]; height?: number }) {
  const max = Math.max(...bars.map((bar) => bar.value), 0);
  const styles = useThemedStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.xs },
    column: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
    track: { width: '100%', justifyContent: 'flex-end', borderRadius: t.radius.button - 4, backgroundColor: t.colors.backgroundSecondary, overflow: 'hidden' },
    fill: { width: '100%', borderRadius: t.radius.button - 4, backgroundColor: t.colors.borderStrong },
    fillCurrent: { backgroundColor: t.colors.accent },
  }));

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel={bars.map((bar) => `${bar.label}: ${bar.accessibilityValue}`).join(', ')}>
      {bars.map((bar, index) => {
        const fraction = max > 0 ? bar.value / max : 0;
        return (
          <View key={`${bar.label}-${index}`} style={styles.column}>
            <View style={[styles.track, { height }]}>
              {bar.value > 0 ? (
                <Animated.View
                  entering={FadeIn.delay(index * 40).duration(300)}
                  style={[styles.fill, bar.current && styles.fillCurrent, { height: Math.max(4, fraction * height) }]}
                />
              ) : null}
            </View>
            <Text variant="caption" tone={bar.current ? 'primary' : 'muted'}>
              {bar.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

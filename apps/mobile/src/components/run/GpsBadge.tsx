import type { GpsSignal } from '@next-stride/shared';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type ColorTokens, useTheme, useThemedStyles } from '@/theme';

const META: Record<GpsSignal, { label: string; color: keyof ColorTokens; bars: number }> = {
  searching: { label: 'Finding GPS…', color: 'warning', bars: 0 },
  good: { label: 'GPS strong', color: 'success', bars: 3 },
  fair: { label: 'GPS fair', color: 'warning', bars: 2 },
  poor: { label: 'GPS weak', color: 'warning', bars: 1 },
  lost: { label: 'GPS signal lost', color: 'error', bars: 0 },
};

/** Live GPS signal indicator (bars + label). */
export function GpsBadge({ signal }: { signal: GpsSignal }) {
  const theme = useTheme();
  const meta = META[signal];
  const styles = useThemedStyles((t) => ({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      height: 32,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.elevated,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 },
    bar: { width: 4, borderRadius: 1 },
  }));
  return (
    <View style={styles.root} accessibilityRole="text" accessibilityLabel={meta.label} accessibilityLiveRegion="polite" testID="gps-badge">
      <View style={styles.bars}>
        {[4, 8, 12].map((height, index) => (
          <View
            key={height}
            style={[styles.bar, { height, backgroundColor: index < meta.bars ? theme.colors[meta.color] : theme.colors.borderStrong }]}
          />
        ))}
      </View>
      <Text variant="caption" tone={signal === 'lost' ? 'error' : 'primary'}>
        {meta.label}
      </Text>
    </View>
  );
}

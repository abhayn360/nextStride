import { View } from 'react-native';

import { useThemedStyles } from '@/theme';

import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  /** `hero` uses the large statistic size. */
  emphasis?: 'default' | 'hero';
  caption?: string;
}

/** Running statistic with tabular numerals so values don't shift as they change. */
export function StatCard({ label, value, unit, icon, emphasis = 'default', caption }: StatCardProps) {
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, gap: t.spacing.xs },
    header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xxs },
  }));
  return (
    <Card style={styles.root} accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <View style={styles.header}>
        {icon ? <Icon name={icon} size={16} color="textSecondary" /> : null}
        <Text variant="overline" tone="secondary">
          {label}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text variant={emphasis === 'hero' ? 'statLarge' : 'statSmall'} tabular>
          {value}
        </Text>
        {unit ? (
          <Text variant="label" tone="secondary">
            {unit}
          </Text>
        ) : null}
      </View>
      {caption ? (
        <Text variant="caption" tone="muted">
          {caption}
        </Text>
      ) : null}
    </Card>
  );
}

import { View } from 'react-native';

import { RouteSketch } from '@/components/map/RouteSketch';
import type { Route } from '@/components/map/route-geometry';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { formatDuration, formatKm, formatPace, formatRunDate, runTitle } from '@/lib/format';
import { useThemedStyles } from '@/theme';

export interface RunCardData {
  startedAt: string | number;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceSecondsPerKm: number | null;
  route: Route;
  /** Not on the server yet. */
  pending?: boolean;
}

export function RunCard({ run, onPress, testID }: { run: RunCardData; onPress: () => void; testID?: string }) {
  const styles = useThemedStyles((t) => ({
    row: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' },
    thumb: { width: 64, height: 64, borderRadius: t.radius.button, overflow: 'hidden', backgroundColor: t.colors.backgroundSecondary },
    body: { flex: 1, gap: t.spacing.xxs },
    header: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    stats: { flexDirection: 'row', gap: t.spacing.md, alignItems: 'baseline' },
    pending: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs },
  }));

  const label = `${runTitle(run.startedAt)}, ${formatKm(run.distanceMeters)} kilometres in ${formatDuration(run.durationSeconds)}`;

  return (
    <Card onPress={onPress} accessibilityLabel={label} testID={testID}>
      <View style={styles.row}>
        <View style={styles.thumb}>
          <RouteSketch route={run.route} strokeWidth={2} />
        </View>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text variant="cardTitle">{runTitle(run.startedAt)}</Text>
            {run.pending ? (
              <View style={styles.pending}>
                <Icon name="upload-cloud" size={12} color="warning" />
                <Text variant="caption" tone="secondary">
                  Waiting to upload
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="muted">
            {formatRunDate(run.startedAt)}
          </Text>
          <View style={styles.stats}>
            <Text variant="section" tabular>
              {formatKm(run.distanceMeters)}
              <Text variant="caption" tone="secondary">
                {' '}
                km
              </Text>
            </Text>
            <Text variant="label" tone="secondary" tabular>
              {formatDuration(run.durationSeconds)}
            </Text>
            <Text variant="label" tone="secondary" tabular>
              {formatPace(run.averagePaceSecondsPerKm)} /km
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color="textMuted" />
      </View>
    </Card>
  );
}

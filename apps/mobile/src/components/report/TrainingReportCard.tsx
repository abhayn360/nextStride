import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { useTrainingReport } from '@/hooks/use-runs';
import { useThemedStyles } from '@/theme';

import { LOAD_META } from './report-copy';

/** One-line summary on Home. Hidden until there's something to report. */
export function TrainingReportCard() {
  const { data } = useTrainingReport();
  const styles = useThemedStyles((t) => ({
    root: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    text: { flex: 1, gap: 2 },
  }));
  if (!data || data.weeks.every((week) => week.runs === 0)) return null;

  const meta = LOAD_META[data.loadTrend.status];
  const easy = data.last7Days.easyPercent;
  const summary = easy === null ? meta.short : `${easy}% easy · ${meta.short}`;
  return (
    <Card onPress={() => router.push('/report')} accessibilityLabel={`Training report. ${summary}`} testID="home-report">
      <View style={styles.root}>
        <Icon name={meta.icon} size={22} color={meta.color} />
        <View style={styles.text}>
          <Text variant="cardTitle">Training report</Text>
          <Text variant="caption" tone="secondary" tabular>
            {summary}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="textMuted" />
      </View>
    </Card>
  );
}

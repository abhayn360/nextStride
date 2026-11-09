import type { ReportPeriod, TrainingReport } from '@next-stride/shared';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { LOAD_META, loadMessage } from '@/components/report/report-copy';
import { BarChart } from '@/components/run/BarChart';
import { Card, EmptyState, ErrorState, Icon, Skeleton, Text } from '@/components/ui';
import { useTrainingReport } from '@/hooks/use-runs';
import { formatKm, formatTotalTime } from '@/lib/format';
import { isApiError } from '@/services';
import { useTheme, useThemedStyles } from '@/theme';

const TARGET_EASY_PERCENT = 80;

export default function TrainingReportScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch, isRefetching } = useTrainingReport();
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm, gap: t.spacing.xl },
    section: { gap: t.spacing.sm },
    skeletons: { padding: t.spacing.xl, gap: t.spacing.md },
    chart: { gap: t.spacing.md },
  }));

  const header = <ScreenHeader title="Training report" />;
  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.skeletons}>
          <Skeleton height={96} radius="card" />
          <Skeleton height={180} radius="card" />
          <Skeleton height={180} radius="card" />
        </View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <ErrorState title="Couldn't load your report" message={isApiError(error) ? error.message : undefined} onRetry={() => void refetch()} />
      </View>
    );
  }

  const hasRuns = data.weeks.some((week) => week.runs > 0);
  const currentWeek = data.weeks.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="report">
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
      >
        {!hasRuns ? (
          <Card>
            <EmptyState icon="bar-chart-2" title="Nothing to report yet" message="Finish a run and your weekly training report will start here." />
          </Card>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <LoadCard trend={data.loadTrend} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.section}>
              <Text variant="section">Easy vs hard</Text>
              <BalanceCard week={data.last7Days} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
              <Text variant="section">Last 7 days</Text>
              <ComparisonCard current={data.last7Days} previous={data.previous7Days} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.section}>
              <Text variant="section">Weekly load</Text>
              <Card style={styles.chart}>
                <BarChart
                  bars={data.weeks.map((week, index) => ({
                    label: `${Number(week.weekStart.slice(8, 10))}/${Number(week.weekStart.slice(5, 7))}`,
                    value: week.load,
                    current: index === currentWeek,
                    accessibilityValue: `load ${week.load}`,
                  }))}
                  height={96}
                />
                <Text variant="caption" tone="muted">
                  Weeks start on the Monday shown. Load is minutes in each pace zone multiplied by the zone number.
                </Text>
              </Card>
            </Animated.View>
            <Text variant="caption" tone="muted">
              A guide based on your pace zones, not medical advice. If something hurts, rest and speak to a professional.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LoadCard({ trend }: { trend: TrainingReport['loadTrend'] }) {
  const styles = useThemedStyles((t) => ({
    root: { flexDirection: 'row', gap: t.spacing.md },
    text: { flex: 1, gap: t.spacing.xxs },
    numbers: { marginTop: t.spacing.xxs },
  }));
  const meta = LOAD_META[trend.status];
  return (
    <Card testID={`report-load-${trend.status}`}>
      <View style={styles.root}>
        <Icon name={meta.icon} size={24} color={meta.color} />
        <View style={styles.text}>
          <Text variant="cardTitle">{meta.title}</Text>
          <Text variant="body" tone="secondary">
            {loadMessage(trend)}
          </Text>
          {trend.ratio !== null ? (
            <Text variant="caption" tone="muted" tabular style={styles.numbers}>
              Last 7 days: {trend.acute} · Usual week: {trend.chronic}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const BALANCE_COPY = {
  balanced: 'Good balance. Mostly easy running builds endurance and leaves energy for your hard days.',
  'too-hard': 'More hard running than ideal. Slow your easy days down so your hard days can count.',
  'not-enough-data': 'Run for at least 30 minutes this week to see your balance.',
} as const;

function BalanceCard({ week }: { week: TrainingReport['last7Days'] }) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    body: { gap: t.spacing.md },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    barWrap: { height: 22, justifyContent: 'center' },
    bar: { flexDirection: 'row', height: 14, borderRadius: t.radius.pill, overflow: 'hidden', backgroundColor: t.colors.backgroundSecondary, gap: 2 },
    tick: { position: 'absolute', left: `${TARGET_EASY_PERCENT}%`, top: 0, bottom: 0, width: 2, backgroundColor: t.colors.textPrimary },
    legend: { flexDirection: 'row', justifyContent: 'space-between' },
    item: { gap: 1 },
    right: { alignItems: 'flex-end' },
  }));
  const hasTime = week.easySeconds + week.hardSeconds > 0;
  return (
    <Card style={styles.body} testID="report-balance">
      <View style={styles.head}>
        <Text variant="stat" tabular testID="report-easy-percent">
          {week.easyPercent ?? '–'}
          <Text variant="label" tone="secondary">
            {' '}
            % easy
          </Text>
        </Text>
        <Text variant="caption" tone="secondary">
          Goal: {TARGET_EASY_PERCENT}%
        </Text>
      </View>
      <View style={styles.barWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.bar}>
          {hasTime ? (
            <>
              <View style={{ flex: week.easySeconds, backgroundColor: theme.colors.zone2 }} />
              <View style={{ flex: week.hardSeconds, backgroundColor: theme.colors.zone5 }} />
            </>
          ) : null}
        </View>
        <View style={styles.tick} />
      </View>
      <View style={styles.legend}>
        <View style={styles.item}>
          <Text variant="label" tabular>
            {formatTotalTime(week.easySeconds)}
          </Text>
          <Text variant="caption" tone="secondary">
            Easy (Z1–Z2)
          </Text>
        </View>
        <View style={[styles.item, styles.right]}>
          <Text variant="label" tabular>
            {formatTotalTime(week.hardSeconds)}
          </Text>
          <Text variant="caption" tone="secondary">
            Hard (Z3–Z5)
          </Text>
        </View>
      </View>
      <Text variant="body" tone="secondary">
        {BALANCE_COPY[week.balance]}
      </Text>
    </Card>
  );
}

function ComparisonCard({ current, previous }: { current: ReportPeriod; previous: ReportPeriod }) {
  const styles = useThemedStyles((t) => ({ body: { gap: t.spacing.sm } }));
  return (
    <Card style={styles.body}>
      <ComparisonRow label="Runs" value={String(current.runs)} before={String(previous.runs)} />
      <ComparisonRow label="Distance" value={`${formatKm(current.distanceMeters, 1)} km`} before={`${formatKm(previous.distanceMeters, 1)} km`} />
      <ComparisonRow label="Time" value={formatTotalTime(current.durationSeconds)} before={formatTotalTime(previous.durationSeconds)} />
      <ComparisonRow label="Load" value={String(current.load)} before={String(previous.load)} />
    </Card>
  );
}

function ComparisonRow({ label, value, before }: { label: string; value: string; before: string }) {
  const styles = useThemedStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'baseline' },
    label: { flex: 1 },
    value: { width: 88, textAlign: 'right' },
    before: { width: 100, textAlign: 'right' },
  }));
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}, previous 7 days ${before}`}>
      <Text variant="body" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <Text variant="label" tabular style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" tabular style={styles.before}>
        was {before}
      </Text>
    </View>
  );
}

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/Logo';
import { ProgressSummaryCard } from '@/components/progress/ProgressSummaryCard';
import { TrainingReportCard } from '@/components/report/TrainingReportCard';
import { BarChart } from '@/components/run/BarChart';
import { RunCard } from '@/components/run/RunCard';
import { Avatar, Banner, Button, Card, EmptyState, Icon, ScalePressable, Skeleton, StatCard, Text } from '@/components/ui';
import { summaryToCard, usePendingRuns, useRunHistory, useRunProgress, useRunStats, useTrainingReport } from '@/hooks/use-runs';
import { firstName, formatDuration, formatKm, formatPace, formatTotalTime, greeting, weekdayInitial } from '@/lib/format';
import { isApiError } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { elapsedMs, useRunStore } from '@/store/run.store';
import { useTheme, useThemedStyles } from '@/theme';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const runPhase = useRunStore((state) => state.phase);
  const stats = useRunStats();
  const progress = useRunProgress();
  const report = useTrainingReport();
  const history = useRunHistory();
  const pending = usePendingRuns();

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing['2xl'], gap: t.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    greeting: { gap: 2, flex: 1 },
    start: { borderRadius: t.radius.cardLarge, backgroundColor: t.colors.accent, padding: t.spacing.xl, gap: t.spacing.md },
    startTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    startCta: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    dim: { opacity: 0.7 },
    row: { flexDirection: 'row', gap: t.spacing.sm },
    section: { gap: t.spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    week: { gap: t.spacing.md },
    weekTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    bests: { gap: t.spacing.md },
    bestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    skeletons: { gap: t.spacing.sm },
  }));

  if (!user) return null;
  const { profile } = user;
  const data = stats.data;
  const recent = (history.data?.pages[0]?.items ?? []).slice(0, 3);
  const pendingRuns = pending.data ?? [];
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

  const refresh = () => {
    void stats.refetch();
    void progress.refetch();
    void report.refetch();
    void history.refetch();
    void pending.refetch();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="home">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={refresh} tintColor={theme.colors.accent} />}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="caption" tone="secondary">
              {greeting()}
            </Text>
            <Text variant="title" testID="home-greeting">
              {firstName(profile.fullName)}
            </Text>
          </View>
          <Avatar name={profile.fullName} uri={profile.avatarUrl} size={44} onPress={() => router.push('/profile')} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          {runPhase !== 'idle' ? (
            <ActiveRunCard />
          ) : (
            <ScalePressable
              onPress={() => router.push('/run')}
              pressedScale={0.985}
              accessibilityRole="button"
              accessibilityLabel="Start a run"
              style={styles.start}
              testID="home-start-run"
            >
              <View style={styles.startTop}>
                <Text variant="overline" tone="onAccent" style={styles.dim}>
                  {data ? `${formatKm(data.thisWeek.distanceMeters, 1)} km this week` : 'Every run. A step forward.'}
                </Text>
                <LogoMark size={32} color={theme.colors.onAccent} />
              </View>
              <View style={styles.startCta}>
                <Text variant="title" tone="onAccent">
                  Start run
                </Text>
                <Icon name="arrow-right" size={24} color="onAccent" />
              </View>
            </ScalePressable>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(400)}>
          <ProgressSummaryCard testID="home-progress" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <TrainingReportCard />
        </Animated.View>

        {stats.error && !data ? (
          <Banner tone="info" message={isApiError(stats.error) ? stats.error.message : 'Stats are unavailable right now.'} />
        ) : null}

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <Card style={styles.week}>
            <View style={styles.weekTop}>
              <View>
                <Text variant="overline" tone="secondary">
                  This week
                </Text>
                {data ? (
                  <Text variant="stat" tabular testID="home-week-distance">
                    {formatKm(data.thisWeek.distanceMeters, 1)}
                    <Text variant="label" tone="secondary">
                      {' '}
                      km
                    </Text>
                  </Text>
                ) : (
                  <Skeleton width={120} height={44} />
                )}
              </View>
              {data ? (
                <Text variant="label" tone="secondary" tabular>
                  {data.thisWeek.runs} {data.thisWeek.runs === 1 ? 'run' : 'runs'} · {formatTotalTime(data.thisWeek.durationSeconds)}
                </Text>
              ) : null}
            </View>
            {data ? (
              <BarChart
                bars={data.daily.map((day, index) => ({
                  label: weekdayInitial(day.date),
                  value: day.distanceMeters,
                  current: index === todayIndex,
                  accessibilityValue: `${formatKm(day.distanceMeters, 1)} km`,
                }))}
                height={72}
              />
            ) : (
              <Skeleton height={96} />
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.section}>
          <View style={styles.row}>
            <StatCard label="This month" value={data ? formatKm(data.thisMonth.distanceMeters, 1) : '–'} unit="km" icon="calendar" />
            <StatCard label="All time" value={data ? formatKm(data.totals.distanceMeters, 1) : '–'} unit="km" icon="globe" />
          </View>
          <View style={styles.row}>
            <StatCard label="Runs" value={data ? String(data.totals.runs) : '–'} icon="activity" />
            <StatCard label="Total time" value={data ? formatTotalTime(data.totals.durationSeconds) : '–'} icon="clock" />
          </View>
        </Animated.View>

        {data && data.totals.runs > 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text variant="section">Personal stats</Text>
            <Card style={styles.bests}>
              <Best
                label="Longest run"
                value={data.personalBests.longestDistance ? `${formatKm(data.personalBests.longestDistance.distanceMeters)} km` : '–'}
                onPress={data.personalBests.longestDistance ? () => router.push({ pathname: '/activity/[id]', params: { id: data.personalBests.longestDistance!.runId } }) : undefined}
              />
              <Best
                label="Fastest pace (1 km+)"
                value={data.personalBests.fastestPace ? `${formatPace(data.personalBests.fastestPace.paceSecondsPerKm)} /km` : '–'}
                onPress={data.personalBests.fastestPace ? () => router.push({ pathname: '/activity/[id]', params: { id: data.personalBests.fastestPace!.runId } }) : undefined}
              />
              <Best
                label="Longest time"
                value={data.personalBests.longestDuration ? formatDuration(data.personalBests.longestDuration.durationSeconds) : '–'}
              />
              <Best label="Average run" value={data.averages.distancePerRunMeters != null ? `${formatKm(data.averages.distancePerRunMeters)} km` : '–'} />
              <Best label="Average pace" value={`${formatPace(data.averages.paceSecondsPerKm)} /km`} />
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="section">Recent activity</Text>
            {recent.length > 0 ? <Button label="See all" variant="text" onPress={() => router.push('/activities')} /> : null}
          </View>
          {pendingRuns.map((run) => (
            <RunCard key={run.localId} run={run} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: run.localId } })} />
          ))}
          {history.isLoading ? (
            <View style={styles.skeletons}>
              <Skeleton height={96} radius="card" />
              <Skeleton height={96} radius="card" />
            </View>
          ) : recent.length > 0 ? (
            recent.map((run) => (
              <RunCard key={run.id} run={summaryToCard(run)} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: run.id } })} />
            ))
          ) : pendingRuns.length === 0 ? (
            <Card>
              <EmptyState icon="map-pin" title="Your first run awaits" message="Tap Start run and head out — your route, distance and pace are recorded with GPS." />
            </Card>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Best({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const styles = useThemedStyles(() => ({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } }));
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <Text variant="cardTitle" tabular tone={onPress ? 'accent' : 'primary'} onPress={onPress} suppressHighlighting>
        {value}
      </Text>
    </View>
  );
}

/** Shown when a run is recording in the background (screen minimised). */
function ActiveRunCard() {
  const run = useRunStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const styles = useThemedStyles((t) => ({
    root: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: run.phase === 'recording' ? t.colors.error : t.colors.warning },
    body: { flex: 1, gap: 2 },
  }));
  return (
    <Card variant="outline" onPress={() => router.push('/run')} accessibilityLabel="Return to your run in progress" testID="home-active-run">
      <View style={styles.root}>
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text variant="cardTitle">{run.phase === 'recording' ? 'Run in progress' : 'Run paused'}</Text>
          <Text variant="caption" tone="secondary" tabular>
            {formatKm(run.distanceMeters)} km · {formatDuration(elapsedMs(run, now) / 1000)}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="textMuted" />
      </View>
    </Card>
  );
}

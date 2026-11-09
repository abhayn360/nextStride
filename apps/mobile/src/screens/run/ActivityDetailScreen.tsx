import { analyzeRun } from '@next-stride/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteMap } from '@/components/map/RouteMap';
import { RunRewardCard } from '@/components/progress/RunRewardCard';
import { BestEffortsCard, RunInsightsCard, ZoneBreakdownCard } from '@/components/run/RunAnalysisCards';
import { AppModal, Banner, Card, ErrorState, Icon, IconButton, Skeleton, Text } from '@/components/ui';
import { type ActivityView, useActivity, useDeleteActivity, useThresholdPace } from '@/hooks/use-runs';
import { formatDuration, formatKm, formatPace, formatRunDate, formatSpeedKmh, runTitle } from '@/lib/format';
import { isApiError } from '@/services';
import { runSync } from '@/services/run';
import { useThemedStyles } from '@/theme';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const remove = useDeleteActivity();
  const { threshold, isLoading: thresholdLoading } = useThresholdPace();
  const thresholdPace = thresholdLoading ? null : threshold.paceSecondsPerKm;
  const analysis = useMemo(
    () => (activity && thresholdPace ? analyzeRun(activity.segments, activity.splits, thresholdPace) : null),
    [activity, thresholdPace],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    map: { height: 320 },
    topBar: { position: 'absolute', left: t.spacing.md, right: t.spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.xl, gap: t.spacing.xl },
    title: { gap: t.spacing.xxs },
    hero: { flexDirection: 'row', gap: t.spacing.md },
    heroCell: { flex: 1, gap: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.lg },
    gridCell: { width: '50%', gap: 2 },
    splitRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xs },
    splitBarTrack: { flex: 1, height: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.backgroundSecondary, overflow: 'hidden' },
    splitBar: { height: '100%', borderRadius: t.radius.pill, backgroundColor: t.colors.accent },
    splitKm: { width: 36 },
    splitPace: { width: 56, textAlign: 'right' },
    section: { gap: t.spacing.sm },
    note: { flexDirection: 'row', gap: t.spacing.xs, alignItems: 'flex-start' },
    noteText: { flex: 1 },
    skeleton: { padding: t.spacing.xl, gap: t.spacing.md },
  }));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/activities'));

  const header = (
    <View style={[styles.topBar, { top: insets.top + 8 }]}>
      <IconButton icon="arrow-left" variant="filled" accessibilityLabel="Back" onPress={close} />
      {activity ? (
        <IconButton icon="trash-2" variant="filled" color="errorText" accessibilityLabel="Delete activity" onPress={() => setConfirmDelete(true)} testID="activity-delete" />
      ) : null}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <Skeleton height={320} radius="button" />
        <View style={styles.skeleton}>
          <Skeleton width="60%" height={24} />
          <Skeleton height={56} />
          <Skeleton height={120} />
        </View>
        {header}
      </View>
    );
  }

  if (error || !activity) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 64 }]}>
        <ErrorState
          title={isApiError(error) && error.status === 404 ? 'Activity not found' : "Couldn't load this activity"}
          message={isApiError(error) ? error.message : undefined}
          onRetry={() => void refetch()}
        />
        {header}
      </View>
    );
  }

  return (
    <View style={styles.root} testID="activity-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <RouteMap route={activity.route} finished style={styles.map} testID="activity-map" />
        <Animated.View entering={FadeInDown.duration(350)} style={styles.content}>
          <View style={styles.title}>
            <Text variant="title">{runTitle(activity.startedAt)}</Text>
            <Text variant="body" tone="secondary">
              {formatRunDate(activity.startedAt)}
            </Text>
          </View>

          {!activity.synced ? <PendingNotice onRetry={() => void runSync.syncAll({ force: true }).then(() => refetch())} /> : null}

          <RunRewardCard activity={activity} />

          <View style={styles.hero}>
            <View style={styles.heroCell}>
              <Text variant="statLarge" tabular testID="activity-distance">
                {formatKm(activity.distanceMeters)}
              </Text>
              <Text variant="overline" tone="secondary">
                Kilometres
              </Text>
            </View>
            <View style={styles.heroCell}>
              <Text variant="statLarge" tabular>
                {formatDuration(activity.durationSeconds)}
              </Text>
              <Text variant="overline" tone="secondary">
                Time
              </Text>
            </View>
          </View>

          <Card>
            <View style={styles.grid}>
              <Stat label="Avg pace" value={`${formatPace(activity.averagePaceSecondsPerKm)} /km`} />
              <Stat label="Moving time" value={formatDuration(activity.movingTimeSeconds)} />
              <Stat label="Avg speed" value={`${formatSpeedKmh(activity.averageSpeed)} km/h`} />
              <Stat label="Calories (est.)" value={activity.caloriesEstimate != null ? `${activity.caloriesEstimate} kcal` : '–'} />
              {analysis ? (
                <>
                  <Stat label="Peak pace (30 s)" value={`${formatPace(analysis.peakPaceSecondsPerKm)} /km`} />
                  <Stat label="Training load (est.)" value={`${analysis.load.score} · ${analysis.load.level}`} />
                  <Stat label="Elevation gain (est.)" value={analysis.elevation ? `${analysis.elevation.gainMeters} m` : '–'} />
                  <Stat label="Elevation loss (est.)" value={analysis.elevation ? `${analysis.elevation.lossMeters} m` : '–'} />
                </>
              ) : null}
            </View>
          </Card>

          {analysis && analysis.zones.totalSeconds > 0 ? <ZoneBreakdownCard analysis={analysis} source={threshold.source} /> : null}
          {analysis ? <RunInsightsCard analysis={analysis} /> : null}

          {activity.splits.length > 0 ? <Splits activity={activity} styles={styles} /> : null}
          {analysis ? <BestEffortsCard analysis={analysis} /> : null}

          <View style={styles.note}>
            <Icon name="info" size={14} color="textMuted" />
            <Text variant="caption" tone="muted" style={styles.noteText}>
              Distance, time, pace and speed are measured from {activity.pointCount} GPS points after filtering out noise. Calories, elevation and training load
              are estimates.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
      {header}

      <AppModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this activity?"
        message={activity.synced ? 'It will be removed from your history on all devices.' : "This run hasn't been uploaded yet. Deleting it removes it from this phone for good."}
        actions={[
          {
            label: 'Delete',
            variant: 'danger',
            loading: remove.isPending,
            onPress: () =>
              remove.mutate(activity, {
                onSuccess: () => {
                  setConfirmDelete(false);
                  close();
                },
              }),
          },
          { label: 'Cancel', variant: 'text', onPress: () => setConfirmDelete(false) },
        ]}
      >
        {remove.error ? <Banner message={isApiError(remove.error) ? remove.error.message : 'Could not delete the activity.'} /> : null}
      </AppModal>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(() => ({ cell: { width: '50%', gap: 2 } }));
  return (
    <View style={styles.cell} accessibilityLabel={`${label}: ${value}`}>
      <Text variant="cardTitle" tabular>
        {value}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function PendingNotice({ onRetry }: { onRetry: () => void }) {
  const styles = useThemedStyles((t) => ({ root: { gap: t.spacing.xs } }));
  return (
    <View style={styles.root}>
      <Banner tone="info" message="Saved on this phone. It will upload automatically when you're back online." />
      <Text variant="label" tone="accent" onPress={onRetry} accessibilityRole="button" suppressHighlighting>
        Upload now
      </Text>
    </View>
  );
}

function Splits({ activity, styles }: { activity: ActivityView; styles: Record<string, object> }) {
  const paces = activity.splits.map((split) => split.paceSecondsPerKm ?? 0).filter((pace) => pace > 0);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  return (
    <View style={styles.section}>
      <Text variant="section">Splits</Text>
      <Card>
        {activity.splits.map((split) => {
          const pace = split.paceSecondsPerKm ?? 0;
          // Faster splits get longer bars.
          const fraction = pace > 0 && slowest > 0 ? 0.35 + 0.65 * ((slowest - pace) / Math.max(1, slowest - fastest)) : 0;
          const partial = split.distanceMeters < 1000;
          return (
            <View key={split.index} style={styles.splitRow} accessibilityLabel={`Kilometre ${split.index}: ${formatPace(pace)} per kilometre`}>
              <Text variant="label" tone="secondary" tabular style={styles.splitKm}>
                {partial ? formatKm(split.distanceMeters, 1) : split.index}
              </Text>
              <View style={styles.splitBarTrack}>
                <View style={[styles.splitBar, { width: `${Math.round(fraction * 100)}%` }]} />
              </View>
              <Text variant="label" tabular style={styles.splitPace}>
                {formatPace(pace)}
              </Text>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

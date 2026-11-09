import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/run/BarChart';
import { RunCard } from '@/components/run/RunCard';
import { Button, Card, EmptyState, ErrorState, SegmentedControl, Skeleton, Text } from '@/components/ui';
import { summaryToCard, usePendingRuns, useRunHistory, useRunStats } from '@/hooks/use-runs';
import { formatKm, formatTotalTime, shortMonth } from '@/lib/format';
import { isApiError } from '@/services';
import { useTheme, useThemedStyles } from '@/theme';

type Period = 'weeks' | 'months';

export default function ActivitiesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('weeks');
  const history = useRunHistory();
  const stats = useRunStats();
  const pending = usePendingRuns();

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    list: { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing['2xl'], gap: t.spacing.sm },
    header: { gap: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm },
    summary: { gap: t.spacing.md },
    totals: { flexDirection: 'row', justifyContent: 'space-between' },
    total: { gap: 2 },
    sectionTitle: { marginTop: t.spacing.sm },
    footer: { paddingVertical: t.spacing.lg },
    skeletons: { gap: t.spacing.xs },
  }));

  const runs = history.data?.pages.flatMap((page) => page.items) ?? [];
  const pendingRuns = pending.data ?? [];
  const refreshing = history.isRefetching || stats.isRefetching;

  const summaryBars =
    period === 'weeks'
      ? (stats.data?.weekly ?? []).map((week, index, all) => ({
          label: `${Number(week.weekStart.slice(8, 10))}/${Number(week.weekStart.slice(5, 7))}`,
          value: week.distanceMeters,
          current: index === all.length - 1,
          accessibilityValue: `${formatKm(week.distanceMeters, 1)} km`,
        }))
      : (stats.data?.monthly ?? []).map((month, index, all) => ({
          label: shortMonth(month.month),
          value: month.distanceMeters,
          current: index === all.length - 1,
          accessibilityValue: `${formatKm(month.distanceMeters, 1)} km`,
        }));
  const currentPeriod = period === 'weeks' ? stats.data?.thisWeek : stats.data?.thisMonth;

  const header = (
    <View style={styles.header}>
      <Text variant="title">Activities</Text>

      <Card style={styles.summary}>
        <SegmentedControl
          options={[
            { value: 'weeks', label: 'Weekly' },
            { value: 'months', label: 'Monthly' },
          ]}
          value={period}
          onChange={setPeriod}
          accessibilityLabel="Summary period"
        />
        {stats.isLoading ? (
          <Skeleton height={140} />
        ) : stats.data ? (
          <>
            <View style={styles.totals}>
              <Total label={period === 'weeks' ? 'This week' : 'This month'} value={`${formatKm(currentPeriod?.distanceMeters ?? 0, 1)} km`} />
              <Total label="Runs" value={String(currentPeriod?.runs ?? 0)} />
              <Total label="Time" value={formatTotalTime(currentPeriod?.durationSeconds ?? 0)} />
            </View>
            <BarChart bars={summaryBars} height={80} />
          </>
        ) : (
          <Text variant="caption" tone="muted">
            {"Summaries appear when you're online."}
          </Text>
        )}
      </Card>

      {pendingRuns.length > 0 ? (
        <>
          <Text variant="overline" tone="secondary" style={styles.sectionTitle}>
            Waiting to upload
          </Text>
          {pendingRuns.map((run) => (
            <RunCard key={run.localId} run={run} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: run.localId } })} />
          ))}
        </>
      ) : null}

      {runs.length > 0 ? (
        <Text variant="overline" tone="secondary" style={styles.sectionTitle}>
          History
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="activities">
      <FlatList
        data={runs}
        keyExtractor={(run) => run.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <RunCard run={summaryToCard(item)} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })} testID={`run-card-${item.id}`} />
        )}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.colors.accent}
            onRefresh={() => {
              void history.refetch();
              void stats.refetch();
              void pending.refetch();
            }}
          />
        }
        ListEmptyComponent={
          history.isLoading ? (
            <View style={styles.skeletons}>
              <Skeleton height={96} radius="card" />
              <Skeleton height={96} radius="card" />
            </View>
          ) : history.error ? (
            <ErrorState
              title="Couldn't load your history"
              message={isApiError(history.error) ? history.error.message : undefined}
              onRetry={() => void history.refetch()}
            />
          ) : pendingRuns.length === 0 ? (
            <EmptyState icon="map" title="No runs yet" message="Your runs will show up here with their route, pace and splits." actionLabel="Start a run" onAction={() => router.push('/run')} />
          ) : undefined
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={theme.colors.accent} />
          ) : history.hasNextPage ? (
            <Button label="Load more" variant="text" onPress={() => void history.fetchNextPage()} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`}>
      <Text variant="cardTitle" tabular>
        {value}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

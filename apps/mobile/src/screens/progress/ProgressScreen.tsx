import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeStatus, type Quest, XP_RULES } from '@next-stride/shared';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { BADGE_ICONS, TIER_COLORS, TIER_LABELS } from '@/components/progress/badge-meta';
import { AppModal, Banner, Card, ErrorState, Icon, ProgressBar, ProgressRing, ScalePressable, Skeleton, StatCard, Text } from '@/components/ui';
import { useRunProgress } from '@/hooks/use-runs';
import { formatCount, formatProgress, formatRunDate } from '@/lib/format';
import { isApiError } from '@/services';
import { useTheme, useThemedStyles } from '@/theme';

const CATEGORIES = Object.keys(BADGE_CATEGORY_LABELS) as BadgeCategory[];

export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch, isRefetching } = useRunProgress();
  const [selected, setSelected] = useState<BadgeStatus | null>(null);

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm, gap: t.spacing.xl },
    hero: { alignItems: 'center', gap: t.spacing.sm },
    heroText: { alignItems: 'center', gap: 2 },
    row: { flexDirection: 'row', gap: t.spacing.sm },
    section: { gap: t.spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    quests: { gap: t.spacing.lg },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.lg },
    categories: { gap: t.spacing.lg },
    category: { gap: t.spacing.md },
    skeletons: { padding: t.spacing.xl, gap: t.spacing.md, alignItems: 'center' },
  }));

  const header = <ScreenHeader title="Progress" />;

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.skeletons}>
          <Skeleton width={140} height={140} radius="pill" />
          <Skeleton height={96} radius="card" />
          <Skeleton height={180} radius="card" />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <ErrorState title="Couldn't load your progress" message={isApiError(error) ? error.message : undefined} onRetry={() => void refetch()} />
      </View>
    );
  }

  const fraction = data.xpForNextLevel ? data.xpIntoLevel / data.xpForNextLevel : 1;
  const { day, week } = data.streaks;
  const earnedCount = data.badges.filter((badge) => badge.earned).length;
  const questsDone = data.quests.items.filter((quest) => quest.completed).length;
  const reminder = day.atRisk && day.current >= 2 ? `Run today to keep your ${day.current}-day streak alive.` : week.atRisk ? `Run this week to keep your ${week.current}-week streak alive.` : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="progress">
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <ProgressRing progress={fraction} size={140} strokeWidth={10} accessibilityLabel={`Progress to level ${data.level + 1}`}>
            <Text variant="overline" tone="secondary">
              Level
            </Text>
            <Text variant="stat" tabular testID="progress-level">
              {data.level}
            </Text>
          </ProgressRing>
          <View style={styles.heroText}>
            <Text variant="section">{data.title}</Text>
            <Text variant="body" tone="secondary" tabular testID="progress-xp">
              {data.xpForNextLevel ? `${data.xpIntoLevel} / ${data.xpForNextLevel} XP to level ${data.level + 1}` : 'Maximum level reached'}
            </Text>
            <Text variant="caption" tone="muted" tabular>
              {data.totalXp.toLocaleString()} XP in total
            </Text>
          </View>
        </Animated.View>

        {reminder ? <Banner tone="info" message={reminder} /> : null}

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.row}>
          <StatCard label="Streak" value={String(day.current)} unit={day.current === 1 ? 'day' : 'days'} icon="zap" caption={`Best: ${day.longest}`} />
          <StatCard label="Streak" value={String(week.current)} unit={week.current === 1 ? 'week' : 'weeks'} icon="calendar" caption={`Best: ${week.longest}`} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="section">Weekly quests</Text>
            <Text variant="label" tone="secondary" tabular>
              {questsDone}/{data.quests.items.length}
            </Text>
          </View>
          <Card style={styles.quests} testID="progress-quests">
            {data.quests.items.map((quest) => (
              <QuestRow key={quest.id} quest={quest} />
            ))}
            <Text variant="caption" tone={data.quests.allComplete ? 'accent' : 'muted'}>
              {data.quests.allComplete ? `All done. You earned the +${data.quests.bonusXp} XP bonus.` : `Finish all three for +${data.quests.bonusXp} bonus XP. New quests every Monday, based on your last 4 weeks.`}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="section">Badges</Text>
            <Text variant="label" tone="secondary" tabular>
              {earnedCount}/{data.badges.length}
            </Text>
          </View>
          <Card>
            <View style={styles.categories}>
              {CATEGORIES.map((category) => (
                <View key={category} style={styles.category}>
                  <Text variant="overline" tone="secondary">
                    {BADGE_CATEGORY_LABELS[category]}
                  </Text>
                  <View style={styles.badgeGrid}>
                    {data.badges
                      .filter((badge) => badge.category === category)
                      .map((badge) => (
                        <BadgeTile key={badge.id} badge={badge} onPress={() => setSelected(badge)} />
                      ))}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        <Text variant="caption" tone="muted">
          You earn {XP_RULES.perKilometer} XP per kilometre and {XP_RULES.perMinute} XP per minute, plus bonuses for streaks, records, quests and badges. Runs under 500 m or at
          vehicle speed do not count. Deleting a run removes what it earned.
        </Text>
      </ScrollView>

      <AppModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        message={selected?.description}
        actions={[{ label: 'Close', variant: 'text', onPress: () => setSelected(null) }]}
      >
        {selected ? <BadgeDetails badge={selected} /> : null}
      </AppModal>
    </View>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const styles = useThemedStyles((t) => ({
    root: { gap: t.spacing.xs },
    top: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    title: { flex: 1 },
  }));
  return (
    <View style={styles.root} testID={`quest-${quest.id}`}>
      <View style={styles.top}>
        <Icon name={quest.completed ? 'check-circle' : 'circle'} size={18} color={quest.completed ? 'accentText' : 'textMuted'} />
        <Text variant="label" style={styles.title}>
          {quest.title}
        </Text>
        <Text variant="caption" tone="secondary" tabular>
          +{quest.xp} XP
        </Text>
      </View>
      <ProgressBar progress={quest.current / quest.target} accessibilityLabel={quest.title} />
      <Text variant="caption" tone="muted" tabular>
        {formatCount(quest.current)} / {formatCount(quest.target)} {quest.unit}
      </Text>
    </View>
  );
}

function BadgeTile({ badge, onPress }: { badge: BadgeStatus; onPress: () => void }) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    root: { width: '33.33%', alignItems: 'center', gap: t.spacing.xs, paddingHorizontal: t.spacing.xxs },
    medal: { width: 56, height: 56, borderRadius: t.radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  }));
  const earned = badge.earned !== null;
  const tier = TIER_COLORS[badge.tier];
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${badge.title}, ${earned ? 'earned' : 'locked'}`}
      style={styles.root}
      testID={`badge-${badge.id}`}
    >
      <View style={[styles.medal, { borderColor: earned ? theme.colors[tier] : theme.colors.border, opacity: earned ? 1 : 0.55 }]}>
        <Icon name={earned ? BADGE_ICONS[badge.category] : 'lock'} size={22} color={earned ? tier : 'textMuted'} />
      </View>
      <Text variant="caption" tone={earned ? 'primary' : 'muted'} align="center" numberOfLines={2}>
        {badge.title}
      </Text>
    </ScalePressable>
  );
}

function BadgeDetails({ badge }: { badge: BadgeStatus }) {
  const styles = useThemedStyles((t) => ({ root: { gap: t.spacing.xs, marginTop: t.spacing.xs } }));
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="secondary">
        {TIER_LABELS[badge.tier]} · +{badge.xp} XP
      </Text>
      {badge.earned ? (
        <Text variant="label" tone="accent">
          Earned {formatRunDate(badge.earned.at)}
        </Text>
      ) : (
        <>
          <ProgressBar progress={badge.current / badge.target} accessibilityLabel={`${badge.title} progress`} />
          <Text variant="caption" tone="muted" tabular>
            {formatProgress(badge.current, badge.target, badge.unit)}
          </Text>
        </>
      )}
    </View>
  );
}

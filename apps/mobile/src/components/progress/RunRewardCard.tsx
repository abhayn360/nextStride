import { type BadgeStatus, baseRunXp, isRewardedRun, levelTitle, type RunReward } from '@next-stride/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Card, Icon, Text } from '@/components/ui';
import { type ActivityView, useRunProgress } from '@/hooks/use-runs';
import { useTheme, useThemedStyles } from '@/theme';

import { BADGE_ICONS, TIER_COLORS } from './badge-meta';

/** A run opened this soon after finishing is the moment to celebrate; older ones are just history. */
const CELEBRATE_WITHIN_MS = 5 * 60 * 1000;

/** XP earned by this run: the full breakdown once uploaded, or an estimate while it's on the phone. */
export function RunRewardCard({ activity }: { activity: ActivityView }) {
  const { data } = useRunProgress();

  if (!activity.synced) {
    if (!isRewardedRun(activity)) return null;
    const base = baseRunXp(activity.distanceMeters, activity.movingTimeSeconds);
    return <PendingReward xp={base.distance + base.time} />;
  }

  const reward = data?.recentRewards.find((item) => item.runId === activity.serverId);
  if (!data || !reward) return null;
  return <EarnedReward reward={reward} badges={data.badges.filter((badge) => reward.badgeIds.includes(badge.id))} completedAt={activity.completedAt} />;
}

function PendingReward({ xp }: { xp: number }) {
  const styles = useThemedStyles((t) => ({ root: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm } }));
  return (
    <Card testID="activity-reward-pending">
      <View style={styles.root}>
        <Icon name="zap" size={18} color="accentText" />
        <Text variant="label" tabular>
          At least +{xp} XP once this run uploads
        </Text>
      </View>
    </Card>
  );
}

function EarnedReward({ reward, badges, completedAt }: { reward: RunReward; badges: BadgeStatus[]; completedAt: number | null }) {
  const theme = useTheme();
  const [celebrate] = useState(() => completedAt !== null && Date.now() - completedAt < CELEBRATE_WITHIN_MS);
  const styles = useThemedStyles((t) => ({
    body: { gap: t.spacing.md },
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    levelUp: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, padding: t.spacing.sm, borderRadius: t.radius.button, backgroundColor: t.colors.accentSubtle },
    lines: { gap: t.spacing.xxs },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md },
    lineLabel: { flex: 1 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
    badge: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs, paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xxs, borderRadius: t.radius.pill, borderWidth: 1 },
  }));
  const leveledUp = reward.levelAfter > reward.levelBefore;

  const buzzed = useRef(false);
  useEffect(() => {
    if (!celebrate || buzzed.current) return;
    buzzed.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [celebrate]);

  return (
    <Animated.View entering={celebrate ? ZoomIn.duration(350) : undefined}>
      <Card testID="activity-reward">
        <View style={styles.body}>
          <View style={styles.head}>
            <Text variant="statSmall" tone="accent" tabular testID="activity-reward-xp">
              +{reward.xp} XP
            </Text>
            <Text variant="overline" tone="secondary">
              Earned
            </Text>
          </View>

          {leveledUp ? (
            <View style={styles.levelUp} accessibilityLiveRegion="polite">
              <Icon name="chevrons-up" size={18} color="accentText" />
              <Text variant="label">
                Level {reward.levelAfter} reached · {levelTitle(reward.levelAfter)}
              </Text>
            </View>
          ) : null}

          <View style={styles.lines}>
            {reward.breakdown.map((line) => (
              <View key={line.label} style={styles.line} accessible accessibilityLabel={`${line.label}: plus ${line.xp} XP`}>
                <Text variant="body" tone="secondary" style={styles.lineLabel}>
                  {line.label}
                </Text>
                <Text variant="label" tabular>
                  +{line.xp}
                </Text>
              </View>
            ))}
          </View>

          {badges.length > 0 ? (
            <View style={styles.badges}>
              {badges.map((badge) => (
                <View key={badge.id} style={[styles.badge, { borderColor: theme.colors[TIER_COLORS[badge.tier]] }]}>
                  <Icon name={BADGE_ICONS[badge.category]} size={14} color={TIER_COLORS[badge.tier]} />
                  <Text variant="caption">{badge.title}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

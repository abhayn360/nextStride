import { router } from 'expo-router';
import { View } from 'react-native';

import { Card, Icon, type IconName, ProgressRing, Skeleton, Text } from '@/components/ui';
import { useRunProgress } from '@/hooks/use-runs';
import { useThemedStyles } from '@/theme';

/** Level, streak, quests and badges at a glance. Tapping opens the full progress screen. */
export function ProgressSummaryCard({ testID }: { testID?: string }) {
  const { data, isLoading } = useRunProgress();
  const styles = useThemedStyles((t) => ({
    body: { gap: t.spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    text: { flex: 1, gap: 2 },
    meta: { flexDirection: 'row', justifyContent: 'space-between' },
  }));

  if (isLoading) return <Skeleton height={136} radius="card" />;
  // Progress adds to these screens but nothing depends on it, so a failed load stays quiet.
  if (!data) return null;

  const fraction = data.xpForNextLevel ? data.xpIntoLevel / data.xpForNextLevel : 1;
  const { day, week } = data.streaks;
  const questsDone = data.quests.items.filter((quest) => quest.completed).length;
  const badges = data.badges.filter((badge) => badge.earned).length;
  const reminder = day.atRisk && day.current >= 2 ? `Run today to keep your ${day.current}-day streak` : week.atRisk ? `Run this week to keep your ${week.current}-week streak` : null;

  return (
    <Card onPress={() => router.push('/progress')} accessibilityLabel={`Level ${data.level}, ${data.title}. Open your progress`} testID={testID}>
      <View style={styles.body}>
        <View style={styles.top}>
          <ProgressRing progress={fraction} size={64} strokeWidth={6} accessibilityLabel={`Progress to level ${data.level + 1}`}>
            <Text variant="section" tabular>
              {data.level}
            </Text>
          </ProgressRing>
          <View style={styles.text}>
            <Text variant="cardTitle">{data.title}</Text>
            <Text variant="caption" tone="secondary" tabular>
              {data.xpForNextLevel ? `${data.xpIntoLevel} / ${data.xpForNextLevel} XP to level ${data.level + 1}` : 'Maximum level reached'}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color="textMuted" />
        </View>
        <View style={styles.meta}>
          <Meta icon="zap" text={`${day.current} day${day.current === 1 ? '' : 's'}`} />
          <Meta icon="target" text={`${questsDone}/${data.quests.items.length} quests`} />
          <Meta icon="award" text={`${badges} badge${badges === 1 ? '' : 's'}`} />
        </View>
        {reminder ? (
          <Text variant="caption" tone="accent">
            {reminder}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const styles = useThemedStyles((t) => ({ root: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs } }));
  return (
    <View style={styles.root}>
      <Icon name={icon} size={14} color="textSecondary" />
      <Text variant="caption" tone="secondary" tabular>
        {text}
      </Text>
    </View>
  );
}

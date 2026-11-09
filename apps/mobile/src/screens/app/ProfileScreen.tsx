import {
  FITNESS_GOAL_LABELS,
  GENDER_LABELS,
  PREFERRED_DISTANCE_LABELS,
  RUNNING_EXPERIENCE_LABELS,
} from '@next-stride/shared';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Banner, Button, Card, Chip, ChipGroup, EmptyState, IconButton, ListItem, ListSection, Text } from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-profile';
import { formatIsoDate, formatMeasurement, formatMonthYear } from '@/lib/format';
import { isApiError } from '@/services';
import { useTheme, useThemedStyles } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refetch, isRefetching, error } = useCurrentUser();
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing['2xl'], gap: t.spacing.xl },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 56 },
    identity: { alignItems: 'center', gap: t.spacing.sm },
    names: { alignItems: 'center', gap: 2 },
    section: { gap: t.spacing.sm },
  }));

  if (!user) return null;
  const { profile } = user;
  const notSet = 'Not set';
  const privacy = profile.privacy;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="profile">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={theme.colors.accent} />}
      >
        <View style={styles.topBar}>
          <Text variant="title">Profile</Text>
          <IconButton icon="edit-2" variant="filled" accessibilityLabel="Edit profile" onPress={() => router.push('/edit-profile')} testID="profile-edit-icon" />
        </View>

        {error ? <Banner tone="info" message={isApiError(error) ? error.message : 'Could not refresh your profile.'} /> : null}

        <Animated.View entering={FadeInDown.duration(400)} style={styles.identity}>
          <Avatar name={profile.fullName} uri={profile.avatarUrl} size={104} />
          <View style={styles.names}>
            <Text variant="section" testID="profile-name">
              {profile.fullName}
            </Text>
            <Text variant="body" tone="secondary" testID="profile-username">
              @{user.username}
            </Text>
          </View>
          {profile.bio ? (
            <Text variant="body" align="center" testID="profile-bio">
              {profile.bio}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            Member since {formatMonthYear(user.createdAt)}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.section}>
          <Text variant="overline" tone="secondary">
            Running
          </Text>
          <Card>
            {profile.runningExperience || profile.preferredDistance ? (
              <ChipGroup>
                {profile.runningExperience ? <Chip label={RUNNING_EXPERIENCE_LABELS[profile.runningExperience].label} selected /> : null}
                {profile.preferredDistance ? <Chip label={PREFERRED_DISTANCE_LABELS[profile.preferredDistance]} selected /> : null}
              </ChipGroup>
            ) : (
              <Text variant="body" tone="muted">
                Add your experience and favourite distance.
              </Text>
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.section}>
          <Text variant="overline" tone="secondary">
            Goals
          </Text>
          <Card>
            {profile.fitnessGoals.length > 0 ? (
              <ChipGroup>
                {profile.fitnessGoals.map((goal) => (
                  <Chip key={goal} label={FITNESS_GOAL_LABELS[goal]} />
                ))}
              </ChipGroup>
            ) : (
              <EmptyState icon="target" title="No goals yet" message="Pick what you're running for." />
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <ListSection title="Personal details" footer="Visible only to you unless you choose otherwise in Settings → Privacy.">
            <ListItem icon="calendar" label="Date of birth" value={formatIsoDate(profile.dateOfBirth) ?? notSet} description={privacy.showAge ? 'Age shown publicly' : 'Private'} />
            <ListItem icon="maximize-2" label="Height" value={formatMeasurement(profile.heightCm, 'cm') ?? notSet} description={privacy.showBodyMetrics ? 'Public' : 'Private'} />
            <ListItem icon="bar-chart-2" label="Weight" value={formatMeasurement(profile.weightKg, 'kg') ?? notSet} description={privacy.showBodyMetrics ? 'Public' : 'Private'} />
            <ListItem icon="user" label="Gender" value={profile.gender ? GENDER_LABELS[profile.gender] : notSet} description={privacy.showGender ? 'Public' : 'Private'} />
          </ListSection>
        </Animated.View>

        <Button label="Edit profile" variant="secondary" leftIcon="edit-2" onPress={() => router.push('/edit-profile')} testID="profile-edit" />
      </ScrollView>
    </View>
  );
}

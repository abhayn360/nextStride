import type { PrivacySettings } from '@next-stride/shared';
import { useState } from 'react';
import { View } from 'react-native';

import { LogoMark, TAGLINE } from '@/components/brand/Logo';
import { AppModal, Banner, ListItem, ListSection, Screen, SegmentedControl, Text } from '@/components/ui';
import { config } from '@/config/env';
import { useLogout } from '@/hooks/use-auth';
import { useUpdateProfile } from '@/hooks/use-profile';
import { usePendingRuns } from '@/hooks/use-runs';
import { isApiError } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { usePreferencesStore } from '@/store/preferences.store';
import { useRunStore } from '@/store/run.store';
import { useThemedStyles } from '@/theme';
import type { ThemePreference } from '@/theme/themes';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export default function SettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const update = useUpdateProfile();
  const logout = useLogout();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const runInProgress = useRunStore((state) => state.phase !== 'idle');
  const pendingUploads = usePendingRuns().data?.length ?? 0;
  // Optimistic toggles: reflect the change instantly, roll back on failure.
  const [pending, setPending] = useState<Partial<PrivacySettings>>({});

  const styles = useThemedStyles((t) => ({
    section: { gap: t.spacing.sm },
    about: { alignItems: 'center', gap: t.spacing.xs, paddingVertical: t.spacing.md },
  }));

  if (!user) return null;
  const privacy = { ...user.profile.privacy, ...pending };

  const setPrivacy = (key: keyof PrivacySettings, value: boolean) => {
    setPending((current) => ({ ...current, [key]: value }));
    update.mutate(
      { privacy: { [key]: value } },
      {
        onSettled: () =>
          setPending((current) => {
            const { [key]: _settled, ...rest } = current;
            return rest;
          }),
      },
    );
  };

  return (
    <Screen bottomInset={false} testID="settings">
      <Text variant="title">Settings</Text>

      <View style={styles.section}>
        <Text variant="overline" tone="secondary">
          Appearance
        </Text>
        <SegmentedControl options={THEME_OPTIONS} value={themePreference} onChange={setThemePreference} accessibilityLabel="Theme" />
      </View>

      {update.isError ? (
        <Banner message={isApiError(update.error) ? update.error.message : 'Could not save your privacy settings.'} />
      ) : null}

      <ListSection title="Privacy" footer="Your email and exact date of birth are never shown to other runners.">
        <ListItem
          label="Show my age"
          description="Displayed on your public profile"
          toggle={{ value: privacy.showAge, onChange: (value) => setPrivacy('showAge', value) }}
          testID="privacy-age"
        />
        <ListItem
          label="Show height & weight"
          toggle={{ value: privacy.showBodyMetrics, onChange: (value) => setPrivacy('showBodyMetrics', value) }}
          testID="privacy-body"
        />
        <ListItem
          label="Show gender"
          toggle={{ value: privacy.showGender, onChange: (value) => setPrivacy('showGender', value) }}
          testID="privacy-gender"
        />
      </ListSection>

      <ListSection title="Account">
        <ListItem icon="mail" label="Email" value={user.email} />
        <ListItem icon="at-sign" label="Username" value={`@${user.username}`} />
        <ListItem icon="log-out" label="Log out" destructive onPress={() => setConfirmLogout(true)} testID="settings-logout" />
      </ListSection>

      <View style={styles.about}>
        <LogoMark size={28} />
        <Text variant="caption" tone="secondary">
          {TAGLINE}
        </Text>
        <Text variant="caption" tone="muted" tabular>
          Version {config.appVersion}
        </Text>
      </View>

      <AppModal
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={runInProgress ? 'Run in progress' : 'Log out?'}
        message={
          runInProgress
            ? 'Finish or discard your current run before logging out.'
            : pendingUploads > 0
              ? `${pendingUploads} ${pendingUploads === 1 ? 'run is' : 'runs are'} still waiting to upload. They stay on this phone and upload the next time you sign in to this account.`
              : "You'll need to sign in again to access your profile on this device."
        }
        actions={
          runInProgress
            ? [{ label: 'OK', variant: 'text', onPress: () => setConfirmLogout(false) }]
            : [
                {
                  label: 'Log out',
                  variant: 'danger',
                  loading: logout.isPending,
                  onPress: () => logout.mutate(undefined, { onSettled: () => setConfirmLogout(false) }),
                },
                { label: 'Cancel', variant: 'text', onPress: () => setConfirmLogout(false) },
              ]
        }
      />
    </Screen>
  );
}

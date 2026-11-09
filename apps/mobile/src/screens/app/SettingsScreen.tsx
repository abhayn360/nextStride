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
import { speakVoiceCoachSample } from '@/services/run/voice-coach';
import { useAuthStore } from '@/store/auth.store';
import { usePreferencesStore, type ZoneAlertCeiling } from '@/store/preferences.store';
import { useRunStore } from '@/store/run.store';
import { useThemedStyles } from '@/theme';
import type { ThemePreference } from '@/theme/themes';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const ZONE_ALERT_OPTIONS: { value: ZoneAlertCeiling; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: '2', label: 'Above Z2' },
  { value: '3', label: 'Above Z3' },
  { value: '4', label: 'Above Z4' },
];

export default function SettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const voiceCoachEnabled = usePreferencesStore((state) => state.voiceCoachEnabled);
  const voiceSplits = usePreferencesStore((state) => state.voiceSplits);
  const zoneAlertCeiling = usePreferencesStore((state) => state.zoneAlertCeiling);
  const setVoicePreferences = usePreferencesStore((state) => state.setVoicePreferences);
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

      <ListSection title="Voice coach" footer="Works with the screen locked and plays over your music. On iPhone, turn off silent mode to hear it.">
        <ListItem
          label="Voice coach"
          toggle={{ value: voiceCoachEnabled, onChange: (value) => setVoicePreferences({ voiceCoachEnabled: value }) }}
          testID="voice-enabled"
        />
        <ListItem
          label="Kilometre splits"
          description="Your split and average pace each kilometre"
          toggle={{ value: voiceSplits, onChange: (value) => setVoicePreferences({ voiceSplits: value }), disabled: !voiceCoachEnabled }}
          testID="voice-splits"
        />
        <ListItem icon="volume-2" label="Play a sample" onPress={speakVoiceCoachSample} testID="voice-sample" />
      </ListSection>

      <View style={styles.section}>
        <Text variant="overline" tone="secondary">
          Tell me to ease back
        </Text>
        <SegmentedControl
          options={ZONE_ALERT_OPTIONS}
          value={zoneAlertCeiling}
          onChange={(value) => setVoicePreferences({ zoneAlertCeiling: value })}
          accessibilityLabel="Tell me to ease back"
        />
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

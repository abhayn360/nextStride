import { Stack } from 'expo-router';

import { usePreferencesStore } from '@/store/preferences.store';
import { useTheme } from '@/theme';

export const unstable_settings = { anchor: 'welcome' };

/** Signed-out flow. Onboarding is shown once per device, then Welcome is the entry point. */
export default function PublicLayout() {
  const theme = useTheme();
  const hasSeenOnboarding = usePreferencesStore((state) => state.hasSeenOnboarding);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Protected guard={!hasSeenOnboarding}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

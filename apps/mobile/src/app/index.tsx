import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth.store';
import { usePreferencesStore } from '@/store/preferences.store';

/**
 * Entry point and fallback for every route guard: sends the user to the right
 * place for their current session state.
 */
export default function Index() {
  const status = useAuthStore((state) => state.status);
  const profileComplete = useAuthStore((state) => state.user?.profile.isComplete ?? false);
  const hasSeenOnboarding = usePreferencesStore((state) => state.hasSeenOnboarding);

  if (status !== 'authenticated') return <Redirect href={hasSeenOnboarding ? '/welcome' : '/onboarding'} />;
  if (!profileComplete) return <Redirect href="/profile-setup" />;
  return <Redirect href="/home" />;
}

import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { useRunSyncTriggers } from '@/hooks/use-runs';
import { runSession } from '@/services/run';
import { useTheme } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

/** Signed-in area: tabs plus screens pushed on top of them. */
export default function AppLayout() {
  const theme = useTheme();
  useRunSyncTriggers();

  // A run left in progress (app killed, phone restarted) is restored and reopened.
  useEffect(() => {
    void runSession.attach().then((run) => {
      if (run) router.push('/run');
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="progress" />
      {/* Full screen, no swipe-to-dismiss: leaving a run is always deliberate. */}
      <Stack.Screen name="run" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="activity/[id]" />
    </Stack>
  );
}

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { BrandSplash } from '@/screens/BrandSplash';
import { session } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { usePreferencesStore } from '@/store/preferences.store';
import { ThemeProvider, useTheme } from '@/theme';

export const unstable_settings = {
  // Failed route guards fall back here; index.tsx redirects to the right place.
  anchor: 'index',
};

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootNavigator fontsReady={fontsLoaded || fontError !== null} />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const theme = useTheme();
  const status = useAuthStore((state) => state.status);
  const profileComplete = useAuthStore((state) => state.user?.profile.isComplete ?? false);
  const preferencesReady = usePreferencesStore((state) => state.hydrated);
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [booted, setBooted] = useState(false);

  // Restore the stored session once, on launch.
  useEffect(() => {
    void session.restore();
  }, []);

  useEffect(() => {
    if (fontsReady) SplashScreen.hide();
  }, [fontsReady]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  // Once the app has booted we never return to the splash, even if status flickers.
  // (Latched during render — React's pattern for state derived from previous renders.)
  if (!booted && splashElapsed && preferencesReady && status !== 'restoring') setBooted(true);

  const onSplashElapsed = useCallback(() => setSplashElapsed(true), []);

  const navigationTheme = useMemo(() => {
    const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.background,
        card: theme.colors.backgroundSecondary,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.accent,
      },
    };
  }, [theme]);

  if (!fontsReady) return null;

  const signedIn = status === 'authenticated';

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {!booted ? (
        <BrandSplash onMinimumElapsed={onSplashElapsed} />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          {/* Route guards: exactly one group is reachable for any session state. */}
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(public)" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !profileComplete}>
            <Stack.Screen name="profile-setup" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && profileComplete}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      )}
    </NavigationThemeProvider>
  );
}

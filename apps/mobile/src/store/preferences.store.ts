import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/theme/themes';

export type ZoneAlertCeiling = 'off' | '2' | '3' | '4';

/** Non-sensitive device preferences. Tokens never go here — see token-storage.ts. */
interface PreferencesState {
  themePreference: ThemePreference;
  hasSeenOnboarding: boolean;
  voiceCoachEnabled: boolean;
  voiceSplits: boolean;
  /** The voice coach speaks up above this zone. */
  zoneAlertCeiling: ZoneAlertCeiling;
  /** True once persisted values have been read from disk. */
  hydrated: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  completeOnboarding: () => void;
  setVoicePreferences: (patch: Partial<Pick<PreferencesState, 'voiceCoachEnabled' | 'voiceSplits' | 'zoneAlertCeiling'>>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'dark',
      hasSeenOnboarding: false,
      voiceCoachEnabled: true,
      voiceSplits: true,
      zoneAlertCeiling: '3',
      hydrated: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      setVoicePreferences: (patch) => set(patch),
    }),
    {
      name: 'next-stride.preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ themePreference, hasSeenOnboarding, voiceCoachEnabled, voiceSplits, zoneAlertCeiling }) => ({
        themePreference,
        hasSeenOnboarding,
        voiceCoachEnabled,
        voiceSplits,
        zoneAlertCeiling,
      }),
      onRehydrateStorage: () => () => {
        usePreferencesStore.setState({ hydrated: true });
      },
    },
  ),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/theme/themes';

/** Non-sensitive device preferences. Tokens never go here — see token-storage.ts. */
interface PreferencesState {
  themePreference: ThemePreference;
  hasSeenOnboarding: boolean;
  /** True once persisted values have been read from disk. */
  hydrated: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  completeOnboarding: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themePreference: 'dark',
      hasSeenOnboarding: false,
      hydrated: false,
      setThemePreference: (themePreference) => set({ themePreference }),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name: 'next-stride.preferences',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ themePreference, hasSeenOnboarding }) => ({ themePreference, hasSeenOnboarding }),
      onRehydrateStorage: () => () => {
        usePreferencesStore.setState({ hydrated: true });
      },
    },
  ),
);

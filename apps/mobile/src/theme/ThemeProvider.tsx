import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type ImageStyle, StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';

import { usePreferencesStore } from '@/store/preferences.store';

import { type Theme, themes } from './themes';

const ThemeContext = createContext<Theme>(themes.dark);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePreferencesStore((state) => state.themePreference);
  const systemScheme = useColorScheme();
  const mode = preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  return <ThemeContext.Provider value={themes[mode]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Theme-aware StyleSheet. Styles are rebuilt only when the theme changes.
 *
 *   const styles = useThemedStyles((t) => ({ root: { backgroundColor: t.colors.background } }));
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function useThemedStyles<S extends NamedStyles>(factory: (theme: Theme) => S & NamedStyles): Readonly<S> {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- factories are static per component
  return useMemo(() => StyleSheet.create(factory(theme)) as Readonly<S>, [theme]);
}

import { type ColorTokens, darkColors, lightColors } from './colors';
import { radius } from './radius';
import { darkShadows, lightShadows, type ShadowTokens } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export type ColorMode = 'dark' | 'light';
/** User preference; `system` follows the OS. Dark is the primary brand experience. */
export type ThemePreference = 'system' | ColorMode;

export interface Theme {
  mode: ColorMode;
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: ShadowTokens;
}

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  typography,
  spacing,
  radius,
  shadows: darkShadows,
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  typography,
  spacing,
  radius,
  shadows: lightShadows,
};

export const themes: Record<ColorMode, Theme> = { dark: darkTheme, light: lightTheme };

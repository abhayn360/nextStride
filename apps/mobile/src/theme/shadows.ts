import type { ViewStyle } from 'react-native';

/**
 * Shadows are used sparingly. Dark surfaces rely on borders and tonal elevation
 * instead, so the dark set is intentionally empty except for floating layers.
 */
export interface ShadowTokens {
  none: ViewStyle;
  /** Cards in light mode. */
  sm: ViewStyle;
  /** Floating elements: tab bar, bottom sheets, modals. */
  lg: ViewStyle;
}

const none: ViewStyle = {};

export const lightShadows: ShadowTokens = {
  none,
  sm: {
    shadowColor: '#111820',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  lg: {
    shadowColor: '#111820',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

export const darkShadows: ShadowTokens = {
  none,
  sm: none,
  lg: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

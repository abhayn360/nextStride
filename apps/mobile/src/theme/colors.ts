/**
 * NEXT STRIDE colour tokens.
 * `palette` holds the raw brand values; screens never use it directly —
 * they consume the semantic tokens from `themes.ts` via `useTheme()`.
 */
export const palette = {
  midnight: '#111820',
  electricLime: '#D7FF64',
  slate: '#252F39',
  offWhite: '#F3F4EF',
  white: '#FFFFFF',
} as const;

export const semantic = {
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#38BDF8',
} as const;

export interface ColorTokens {
  background: string;
  backgroundSecondary: string;
  card: string;
  elevated: string;
  border: string;
  /** Border for focused inputs and selected controls. */
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  /** Placeholders, disabled labels. */
  textMuted: string;
  accent: string;
  /** Accent used as text/icon on the page background — tuned for readable contrast. */
  accentText: string;
  /** Low-emphasis accent fill for selected chips, highlights. */
  accentSubtle: string;
  /** Content placed on top of `accent`. */
  onAccent: string;
  success: string;
  warning: string;
  error: string;
  /** Error colour for text on the page background. */
  errorText: string;
  errorSubtle: string;
  info: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
}

export const darkColors: ColorTokens = {
  background: palette.midnight,
  backgroundSecondary: '#1A232C',
  card: palette.slate,
  elevated: '#202B35',
  border: '#303C47',
  borderStrong: '#4A5966',
  textPrimary: palette.white,
  textSecondary: '#AAB4BE',
  textMuted: '#74808B',
  accent: palette.electricLime,
  accentText: palette.electricLime,
  accentSubtle: 'rgba(215, 255, 100, 0.12)',
  onAccent: palette.midnight,
  success: semantic.success,
  warning: semantic.warning,
  error: semantic.error,
  errorText: '#F87171',
  errorSubtle: 'rgba(239, 68, 68, 0.14)',
  info: semantic.info,
  overlay: 'rgba(5, 9, 13, 0.72)',
  skeleton: '#202B35',
  skeletonHighlight: '#2B3742',
};

export const lightColors: ColorTokens = {
  background: palette.offWhite,
  backgroundSecondary: '#E9ECE6',
  card: palette.white,
  elevated: palette.white,
  border: '#DCE2D9',
  borderStrong: '#B7C1B3',
  textPrimary: palette.midnight,
  textSecondary: '#64748B',
  textMuted: '#94A0AE',
  accent: '#83A92E',
  // #83A92E on Off White is ~2.6:1 — too light for text, so text uses a deeper shade (~5:1).
  accentText: '#56731A',
  accentSubtle: 'rgba(131, 169, 46, 0.14)',
  onAccent: palette.midnight,
  success: semantic.success,
  warning: semantic.warning,
  error: semantic.error,
  errorText: '#C62828',
  errorSubtle: 'rgba(239, 68, 68, 0.10)',
  info: semantic.info,
  overlay: 'rgba(17, 24, 32, 0.45)',
  skeleton: '#E4E8E1',
  skeletonHighlight: '#EEF1EB',
};

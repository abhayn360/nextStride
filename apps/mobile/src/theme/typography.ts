import type { TextStyle } from 'react-native';

/** Inter faces loaded in the root layout (see `fontAssets`). */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/**
 * Type scale. Font weight is expressed through the family (not `fontWeight`)
 * so custom fonts render correctly on Android.
 */
export const typography = {
  /** 32 bold — hero headings. */
  hero: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  /** 26 bold — screen headings. */
  title: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  /** 20 semibold — section headings. */
  section: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  /** 16 semibold — card headings. */
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22 },
  /** 16 regular — lead paragraphs (onboarding, empty states). */
  bodyLarge: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  /** 14 regular — body text. */
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21 },
  /** 14 medium — form labels, list values. */
  label: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  /** 15 semibold — button labels. */
  button: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.1 },
  /** 12 regular — secondary text, helper text. */
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  /** 12 semibold uppercase — overlines and section eyebrows. */
  overline: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  /** 40 bold tabular — running statistics. */
  stat: { fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  /** 48 bold tabular — the headline statistic on a screen. */
  statLarge: {
    fontFamily: fontFamily.bold,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  /** 36 bold tabular — compact statistics inside cards. */
  statSmall: {
    fontFamily: fontFamily.bold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Apply to any numeric text (distance, duration, pace) so digits don't jitter. */
export const tabularNumbers: TextStyle = { fontVariant: ['tabular-nums'] };

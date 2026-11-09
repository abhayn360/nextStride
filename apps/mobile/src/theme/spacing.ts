/** 4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export type SpacingToken = keyof typeof spacing;

/** Horizontal padding for screen content. */
export const screenPadding = spacing.xl;

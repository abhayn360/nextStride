import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { type ColorTokens, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** A colour token name; defaults to primary text. */
  color?: keyof ColorTokens;
}

/** Thin-stroke icon set used across the app for a consistent, minimal look. */
export function Icon({ name, size = 20, color = 'textPrimary' }: IconProps) {
  const theme = useTheme();
  return <Feather name={name} size={size} color={theme.colors[color]} />;
}

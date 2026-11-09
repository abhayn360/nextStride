import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { type ColorTokens, type TypographyVariant, useTheme } from '@/theme';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'error' | 'onAccent' | 'success';

const toneToken: Record<TextTone, keyof ColorTokens> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  accent: 'accentText',
  error: 'errorText',
  onAccent: 'onAccent',
  success: 'success',
};

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  /** Fixed-width digits for stats, times and distances. */
  tabular?: boolean;
  uppercase?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  align,
  tabular,
  uppercase,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[toneToken[tone]] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        uppercase || variant === 'overline' ? { textTransform: 'uppercase' } : null,
        style,
      ]}
    />
  );
}

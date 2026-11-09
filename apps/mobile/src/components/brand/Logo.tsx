import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/Text';
import { useTheme, useThemedStyles } from '@/theme';

/**
 * The NEXT STRIDE mark: a forward chevron leading a fainter trailing stride —
 * motion, progress, "the next step".
 */
export function LogoMark({ size = 48, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const fill = color ?? theme.colors.accent;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="NEXT STRIDE">
      <Path d="M8 8h9l12 16-12 16H8l12-16z" fill={fill} opacity={0.35} />
      <Path d="M21 8h9l12 16-12 16h-9l12-16z" fill={fill} />
    </Svg>
  );
}

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const styles = useThemedStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'center' },
    lg: { fontSize: 28, lineHeight: 34, letterSpacing: 5 },
    md: { fontSize: 18, lineHeight: 24, letterSpacing: 3.5 },
  }));
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="NEXT STRIDE">
      <Text variant="section" style={styles[size]}>
        NEXT{' '}
      </Text>
      <Text variant="section" tone="accent" style={styles[size]}>
        STRIDE
      </Text>
    </View>
  );
}

export const TAGLINE = 'Every Run. A Step Forward.';

export function Logo({ size = 'md', showTagline = false }: { size?: 'md' | 'lg'; showTagline?: boolean }) {
  const styles = useThemedStyles((t) => ({
    root: { alignItems: 'center', gap: t.spacing.md },
    text: { alignItems: 'center', gap: t.spacing.xs },
  }));
  return (
    <View style={styles.root}>
      <LogoMark size={size === 'lg' ? 72 : 44} />
      <View style={styles.text}>
        <Wordmark size={size} />
        {showTagline ? (
          <Text variant="body" tone="secondary">
            {TAGLINE}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

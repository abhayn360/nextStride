import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemedStyles } from '@/theme';

export interface ScreenHeaderProps {
  title?: string;
  /** Show a back button (defaults to true when there is history). */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

/** Custom stack header so navigation chrome matches the design system on both platforms. */
export function ScreenHeader({ title, back = true, onBack, right }: ScreenHeaderProps) {
  const styles = useThemedStyles((t) => ({
    root: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
    },
    side: { width: 72, flexDirection: 'row', alignItems: 'center' },
    right: { justifyContent: 'flex-end' },
    title: { flex: 1 },
  }));

  const canGoBack = back && (onBack !== undefined || router.canGoBack());

  return (
    <View style={styles.root} accessibilityRole="header">
      <View style={styles.side}>
        {canGoBack ? (
          <IconButton icon="arrow-left" accessibilityLabel="Go back" onPress={onBack ?? (() => router.back())} />
        ) : null}
      </View>
      <View style={styles.title}>
        {title ? (
          <Text variant="cardTitle" align="center" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

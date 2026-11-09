import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Screen, Text } from '@/components/ui';
import { useThemedStyles } from '@/theme';

/** Shared frame for auth forms: back header, title block, form, footer actions. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  testID,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const styles = useThemedStyles((t) => ({
    heading: { gap: t.spacing.xs, marginBottom: t.spacing.xs },
    form: { gap: t.spacing.lg },
  }));
  return (
    <Screen keyboard header={<ScreenHeader />} footer={footer} testID={testID}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.heading}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <View style={styles.form}>{children}</View>
      </Animated.View>
    </Screen>
  );
}

export function AuthFooterLink({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  const styles = useThemedStyles((t) => ({
    row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
    link: { padding: t.spacing.xs },
  }));
  return (
    <View style={styles.row}>
      <Text variant="body" tone="secondary">
        {prompt}
      </Text>
      <Text variant="label" tone="accent" onPress={onPress} accessibilityRole="link" suppressHighlighting style={styles.link}>
        {action}
      </Text>
    </View>
  );
}

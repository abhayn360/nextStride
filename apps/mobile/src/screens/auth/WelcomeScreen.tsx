import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandRings } from '@/components/brand/Illustrations';
import { Logo } from '@/components/brand/Logo';
import { SessionNotice } from '@/components/brand/SessionNotice';
import { Button, Screen, Text } from '@/components/ui';
import { useThemedStyles } from '@/theme';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const styles = useThemedStyles((t) => ({
    content: { flex: 1, justifyContent: 'space-between' },
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl },
    art: { position: 'absolute' },
    copy: { gap: t.spacing.sm },
    actions: { gap: t.spacing.xs },
  }));

  return (
    <Screen
      scroll={false}
      testID="welcome"
      contentStyle={styles.content}
      footer={
        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.actions}>
          <Button label="Create account" onPress={() => router.push('/register')} testID="welcome-register" />
          <Button
            label="I already have an account"
            variant="secondary"
            onPress={() => router.push('/login')}
            testID="welcome-login"
          />
        </Animated.View>
      }
    >
      <SessionNotice />
      <View style={styles.hero}>
        <View style={styles.art} pointerEvents="none">
          <BrandRings size={Math.min(width * 1.1, 440)} />
        </View>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Logo size="lg" showTagline />
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.copy}>
        <Text variant="section" align="center">
          Run with purpose.
        </Text>
        <Text variant="body" tone="secondary" align="center">
          Your runs, your goals and your progress — together in one place.
        </Text>
      </Animated.View>
    </Screen>
  );
}

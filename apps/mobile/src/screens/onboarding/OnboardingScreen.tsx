import { type ComponentType, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AchievementIllustration, ProgressIllustration, RouteIllustration } from '@/components/brand/Illustrations';
import { LogoMark } from '@/components/brand/Logo';
import { Button, Text } from '@/components/ui';
import { usePreferencesStore } from '@/store/preferences.store';
import { useTheme, useThemedStyles } from '@/theme';

interface Page {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  Illustration: ComponentType<{ size: number; active: boolean }>;
}

const PAGES: Page[] = [
  {
    key: 'track',
    eyebrow: 'Track',
    title: 'Every Run Matters',
    body: 'Record the distance, pace and time of every run, and build a running history that shows exactly how far you have come.',
    Illustration: RouteIllustration,
  },
  {
    key: 'progress',
    eyebrow: 'Improve',
    title: 'Progress Every Day',
    body: 'Set goals that fit your life and follow your performance over time. Small, steady steps add up to real results.',
    Illustration: ProgressIllustration,
  },
  {
    key: 'achieve',
    eyebrow: 'Coming soon',
    title: 'Your Next Achievement',
    body: 'XP, levels and achievements are on their way to NEXT STRIDE. Soon every kilometre you run will move you up.',
    Illustration: AchievementIllustration,
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const completeOnboarding = usePreferencesStore((state) => state.completeOnboarding);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const finishing = useRef(false);

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.xl, height: 56 },
    page: { flex: 1, paddingHorizontal: t.spacing.xl, justifyContent: 'center' },
    illustration: { alignItems: 'center', marginBottom: t.spacing['2xl'] },
    copy: { gap: t.spacing.sm },
    footer: { paddingHorizontal: t.spacing.xl, gap: t.spacing.xl },
    dots: { flexDirection: 'row', gap: t.spacing.xs, alignItems: 'center' },
  }));

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    // The protected route guard moves the user on to the welcome screen.
    completeOnboarding();
  };

  const next = () => {
    if (index >= PAGES.length - 1) return finish();
    const target = index + 1;
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
  };

  const isLast = index === PAGES.length - 1;
  const illustrationSize = Math.min(width - 96, 300);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="onboarding">
      <View style={styles.topBar}>
        <LogoMark size={28} />
        {!isLast ? <Button label="Skip" variant="text" onPress={finish} testID="onboarding-skip" /> : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
      >
        {PAGES.map((page, pageIndex) => (
          <OnboardingPage
            key={page.key}
            page={page}
            index={pageIndex}
            width={width}
            scrollX={scrollX}
            active={index === pageIndex}
            illustrationSize={illustrationSize}
            styles={styles}
          />
        ))}
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}>
          {PAGES.map((page, dotIndex) => (
            <Dot key={page.key} index={dotIndex} width={width} scrollX={scrollX} />
          ))}
        </View>
        <Button
          label={isLast ? 'Get started' : 'Continue'}
          rightIcon={isLast ? undefined : 'arrow-right'}
          onPress={next}
          testID="onboarding-next"
        />
      </View>
    </View>
  );
}

function OnboardingPage({
  page,
  index,
  width,
  scrollX,
  active,
  illustrationSize,
  styles,
}: {
  page: Page;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  active: boolean;
  illustrationSize: number;
  styles: { page: object; illustration: object; copy: object };
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(scrollX.value, range, [40, 0, -40], Extrapolation.CLAMP) }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0.2, 1, 0.2], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollX.value, range, [0.9, 1, 0.9], Extrapolation.CLAMP) }],
  }));
  const { Illustration } = page;

  return (
    <View style={[styles.page, { width }]} accessibilityLabel={`${page.title}. ${page.body}`}>
      <Animated.View style={[styles.illustration, artStyle]}>
        <Illustration size={illustrationSize} active={active} />
      </Animated.View>
      <Animated.View style={[styles.copy, copyStyle]}>
        <Text variant="overline" tone="accent">
          {page.eyebrow}
        </Text>
        <Text variant="hero">{page.title}</Text>
        <Text variant="bodyLarge" tone="secondary">
          {page.body}
        </Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const position = scrollX.value / width;
    const distance = Math.min(1, Math.abs(position - index));
    return {
      width: interpolate(distance, [0, 1], [28, 8]),
      backgroundColor: distance < 0.5 ? theme.colors.accent : theme.colors.borderStrong,
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: theme.radius.pill }, style]} />;
}

import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useThemedStyles } from '@/theme';

const ICONS: Record<string, IconName> = {
  home: 'home',
  activities: 'activity',
  profile: 'user',
  settings: 'settings',
};

/** Branded bottom navigation. The active tab gets the Electric Lime indicator. */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((t) => ({
    root: {
      flexDirection: 'row',
      backgroundColor: t.colors.backgroundSecondary,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      paddingTop: t.spacing.xs,
      paddingHorizontal: t.spacing.md,
    },
    tab: { flex: 1, alignItems: 'center', gap: t.spacing.xxs, paddingVertical: t.spacing.xxs },
    indicator: { width: 40, height: 28, borderRadius: t.radius.pill, alignItems: 'center', justifyContent: 'center' },
    indicatorActive: { backgroundColor: t.colors.accentSubtle },
  }));

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const focused = state.index === index;
        const label = descriptor.options.title ?? route.name;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <ScalePressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            testID={`tab-${route.name}`}
            style={styles.tab}
          >
            <View style={[styles.indicator, focused && styles.indicatorActive]}>
              <Icon name={ICONS[route.name] ?? 'circle'} size={20} color={focused ? 'accentText' : 'textMuted'} />
            </View>
            <Text variant="caption" tone={focused ? 'primary' : 'muted'}>
              {label}
            </Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

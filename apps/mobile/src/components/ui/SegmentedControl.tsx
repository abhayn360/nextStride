import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { motion, useThemedStyles } from '@/theme';

import { Text } from './Text';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const [width, setWidth] = useState(0);
  const styles = useThemedStyles((t) => ({
    root: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: t.radius.input,
      backgroundColor: t.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    thumb: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: t.radius.button - 2,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
    },
    segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  }));

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = width > 0 ? (width - 8) / options.length : 0;
  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: withTiming(index * segmentWidth, { duration: motion.duration.base, easing: motion.easing.standard }) }],
  }));

  return (
    <View
      style={styles.root}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? <Animated.View style={[styles.thumb, thumbStyle]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={styles.segment}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            <Text variant="label" tone={selected ? 'primary' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { useTheme, useThemedStyles } from '@/theme';

import { Icon } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /** Shows a camera badge and makes the avatar pressable. */
  onPress?: () => void;
  loading?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({ uri, name, size = 72, onPress, loading = false }: AvatarProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.accentSubtle,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    badge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: t.colors.background,
    },
    overlay: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.overlay },
  }));

  const content = (
    <View>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
        ) : (
          <Text variant={size >= 72 ? 'section' : 'cardTitle'} tone="accent" style={{ fontSize: size * 0.34, lineHeight: size * 0.42 }}>
            {initials(name)}
          </Text>
        )}
        {loading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : null}
      </View>
      {onPress ? (
        <View style={styles.badge}>
          <Icon name="camera" size={14} color="onAccent" />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return <View accessibilityLabel={`${name}'s profile picture`}>{content}</View>;
  return (
    <ScalePressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Change profile picture"
    >
      {content}
    </ScalePressable>
  );
}

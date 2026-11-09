import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Header rendered above the scroll area, inside the safe area. */
  header?: ReactNode;
  /** Pinned to the bottom (e.g. primary action), above the home indicator. */
  footer?: ReactNode;
  /** Avoid the keyboard for forms. */
  keyboard?: boolean;
  /** Add the bottom inset (off for tab screens, where the tab bar handles it). */
  bottomInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  background?: 'primary' | 'secondary';
  testID?: string;
}

/** Base layout for every screen: safe areas, background, padding, keyboard handling. */
export function Screen({
  children,
  scroll = true,
  header,
  footer,
  keyboard = false,
  bottomInset = true,
  contentStyle,
  background = 'primary',
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    secondary: { backgroundColor: t.colors.backgroundSecondary },
    flex: { flex: 1 },
    content: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing['2xl'], gap: t.spacing.xl },
    staticContent: { flex: 1 },
    footer: { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm, gap: t.spacing.sm },
  }));

  const bottomPadding = bottomInset ? Math.max(insets.bottom, 16) : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, !footer && { paddingBottom: bottomPadding + 32 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.staticContent, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {header}
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: bottomPadding }]}>{footer}</View> : null}
    </>
  );

  return (
    <View testID={testID} style={[styles.root, background === 'secondary' && styles.secondary, { paddingTop: insets.top }]}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles } from '@/theme';

import { Button, type ButtonVariant } from './Button';
import { Text } from './Text';

export interface ModalAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
}

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  actions?: ModalAction[];
  children?: ReactNode;
}

/** Centred dialog for confirmations. */
export function AppModal({ visible, onClose, title, message, actions = [], children }: AppModalProps) {
  const styles = useThemedStyles((t) => ({
    backdrop: { flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: t.radius.modal,
      backgroundColor: t.colors.elevated,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: t.spacing.xl,
      gap: t.spacing.sm,
      ...t.shadows.lg,
    },
    actions: { marginTop: t.spacing.md, gap: t.spacing.xs },
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} accessibilityLabel="Close dialog" />
          <Animated.View entering={ZoomIn.duration(220).springify().damping(20)} style={styles.card} accessibilityViewIsModal>
            <Text variant="section">{title}</Text>
            {message ? (
              <Text variant="body" tone="secondary">
                {message}
              </Text>
            ) : null}
            {children}
            {actions.length > 0 ? (
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Button key={action.label} {...action} size="md" />
                ))}
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** Slide-up sheet for contextual choices (e.g. profile photo actions). */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((t) => ({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
    sheet: {
      backgroundColor: t.colors.elevated,
      borderTopLeftRadius: t.radius.modal,
      borderTopRightRadius: t.radius.modal,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: t.spacing.xl,
      paddingTop: t.spacing.sm,
      gap: t.spacing.md,
      ...t.shadows.lg,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: t.radius.pill, backgroundColor: t.colors.borderStrong, marginBottom: t.spacing.xs },
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible ? (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
            <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(280)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            {title ? <Text variant="cardTitle">{title}</Text> : null}
            {children}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

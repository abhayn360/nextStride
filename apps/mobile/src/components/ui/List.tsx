import { Children, Fragment, type ReactNode } from 'react';
import { Switch, View } from 'react-native';

import { palette, useTheme, useThemedStyles } from '@/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function Divider({ inset = 0 }: { inset?: number }) {
  const styles = useThemedStyles((t) => ({ line: { height: 1, backgroundColor: t.colors.border } }));
  return <View style={[styles.line, { marginLeft: inset }]} />;
}

/** Titled group of list rows inside a card, separated by hairlines. */
export function ListSection({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const styles = useThemedStyles((t) => ({
    root: { gap: t.spacing.xs },
    card: {
      borderRadius: t.radius.card,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.mode === 'dark' ? t.colors.card : t.colors.border,
      overflow: 'hidden',
    },
    title: { paddingHorizontal: t.spacing.xxs },
    footer: { paddingHorizontal: t.spacing.xxs },
  }));
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.root}>
      {title ? (
        <Text variant="overline" tone="secondary" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <Divider inset={16} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" tone="muted" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export interface ListItemProps {
  label: string;
  value?: string;
  description?: string;
  icon?: IconName;
  onPress?: () => void;
  /** Shows a switch instead of a chevron. */
  toggle?: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean };
  destructive?: boolean;
  testID?: string;
}

export function ListItem({ label, value, description, icon, onPress, toggle, destructive, testID }: ListItemProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 56, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm },
    text: { flex: 1, gap: 2 },
    value: { maxWidth: '50%' },
  }));

  const content = (
    <>
      {icon ? <Icon name={icon} size={18} color={destructive ? 'errorText' : 'textSecondary'} /> : null}
      <View style={styles.text}>
        <Text variant="label" tone={destructive ? 'error' : 'primary'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          testID={testID ? `${testID}-switch` : undefined}
          value={toggle.value}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
          thumbColor={palette.white}
          ios_backgroundColor={theme.colors.border}
          accessibilityLabel={label}
        />
      ) : onPress ? (
        <Icon name="chevron-right" size={18} color="textMuted" />
      ) : null}
    </>
  );

  if (onPress && !toggle) {
    return (
      <ScalePressable testID={testID} onPress={onPress} pressedScale={0.99} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
        {content}
      </ScalePressable>
    );
  }
  return (
    <View testID={testID} style={styles.row}>
      {content}
    </View>
  );
}

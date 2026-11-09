import { type ComponentRef, type ReactNode, type Ref, useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';

import { useTheme, useThemedStyles } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helper?: string;
  leftIcon?: IconName;
  /** Rendered at the trailing edge (e.g. a unit like "cm"). */
  trailing?: ReactNode;
  /** Adds a show/hide toggle and hides input by default. */
  password?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export type TextFieldRef = ComponentRef<typeof TextInput>;

export function TextField({
  label,
  error,
  helper,
  leftIcon,
  trailing,
  password,
  onFocus,
  onBlur,
  editable = true,
  multiline,
  ref,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const styles = useThemedStyles((t) => ({
    root: { gap: t.spacing.xs },
    field: {
      minHeight: 52,
      borderRadius: t.radius.input,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.backgroundSecondary,
      paddingHorizontal: t.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    multiline: { minHeight: 104, alignItems: 'flex-start', paddingVertical: t.spacing.sm },
    focused: { borderColor: t.colors.accent },
    errored: { borderColor: t.colors.error },
    disabled: { opacity: 0.55 },
    input: {
      flex: 1,
      ...t.typography.body,
      fontSize: 15,
      color: t.colors.textPrimary,
      paddingVertical: t.spacing.sm,
    },
    inputMultiline: { textAlignVertical: 'top', minHeight: 80 },
  }));

  const message = error ?? helper;

  return (
    <View style={styles.root}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.errored : null,
          !editable && styles.disabled,
        ]}
      >
        {leftIcon ? <Icon name={leftIcon} size={18} color={focused ? 'accentText' : 'textMuted'} /> : null}
        <TextInput
          ref={ref}
          {...inputProps}
          multiline={multiline}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.accent}
          cursorColor={theme.colors.accent}
          keyboardAppearance={theme.mode}
          secureTextEntry={password ? !revealed : inputProps.secureTextEntry}
          autoCapitalize={password ? 'none' : inputProps.autoCapitalize}
          autoCorrect={password ? false : inputProps.autoCorrect}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {password ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={18} color="textMuted" />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {message ? (
        <Text variant="caption" tone={error ? 'error' : 'muted'} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

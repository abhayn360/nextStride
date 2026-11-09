import { PASSWORD_MIN_LENGTH, registerSchema } from '@next-stride/shared';
import { router } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';

import { Banner, Button, Icon, Text, TextField, type TextFieldRef } from '@/components/ui';
import { useRegister } from '@/hooks/use-auth';
import { useForm } from '@/hooks/use-form';
import { useThemedStyles } from '@/theme';

import { AuthFooterLink, AuthLayout } from './AuthLayout';

function PasswordRules({ password }: { password: string }) {
  const styles = useThemedStyles((t) => ({
    root: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md, marginTop: -t.spacing.xs },
    rule: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs },
  }));
  const rules = [
    { label: `${PASSWORD_MIN_LENGTH}+ characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'A letter', met: /[A-Za-z]/.test(password) },
    { label: 'A number', met: /[0-9]/.test(password) },
  ];
  return (
    <View style={styles.root}>
      {rules.map((rule) => (
        <View key={rule.label} style={styles.rule} accessibilityLabel={`${rule.label}${rule.met ? ', met' : ''}`}>
          <Icon name={rule.met ? 'check-circle' : 'circle'} size={14} color={rule.met ? 'accentText' : 'textMuted'} />
          <Text variant="caption" tone={rule.met ? 'primary' : 'muted'}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const register = useRegister();
  const usernameRef = useRef<TextFieldRef>(null);
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);
  const { values, setField, errors, validate, applyError } = useForm({
    fullName: '',
    username: '',
    email: '',
    password: '',
  });

  const submit = () => {
    const input = validate(registerSchema);
    if (!input) return;
    register.mutate(input, { onError: applyError });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join NEXT STRIDE and make every run count."
      testID="register"
      footer={
        <>
          <Button label="Create account" onPress={submit} loading={register.isPending} testID="register-submit" />
          <AuthFooterLink prompt="Already a member?" action="Sign in" onPress={() => router.replace('/login')} />
        </>
      }
    >
      {errors.form ? <Banner message={errors.form} /> : null}
      <TextField
        label="Full name"
        leftIcon="user"
        value={values.fullName}
        onChangeText={(text) => setField('fullName', text)}
        error={errors.fullName}
        placeholder="Ada Runner"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
        testID="register-name"
      />
      <TextField
        ref={usernameRef}
        label="Username"
        leftIcon="at-sign"
        value={values.username}
        onChangeText={(text) => setField('username', text.toLowerCase().replace(/\s/g, ''))}
        error={errors.username}
        helper="Letters, numbers and underscores."
        placeholder="ada_runs"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        testID="register-username"
      />
      <TextField
        ref={emailRef}
        label="Email"
        leftIcon="mail"
        value={values.email}
        onChangeText={(text) => setField('email', text)}
        error={errors.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        testID="register-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        leftIcon="lock"
        password
        value={values.password}
        onChangeText={(text) => setField('password', text)}
        error={errors.password}
        placeholder="Create a password"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="register-password"
      />
      <PasswordRules password={values.password} />
    </AuthLayout>
  );
}

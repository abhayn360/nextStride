import { loginSchema } from '@next-stride/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';

import { SessionNotice } from '@/components/brand/SessionNotice';
import { Banner, Button, TextField, type TextFieldRef } from '@/components/ui';
import { useLogin } from '@/hooks/use-auth';
import { useForm } from '@/hooks/use-form';
import { useThemedStyles } from '@/theme';

import { AuthFooterLink, AuthLayout } from './AuthLayout';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ reset?: string }>();
  const passwordRef = useRef<TextFieldRef>(null);
  const login = useLogin();
  const styles = useThemedStyles((t) => ({
    passwordBlock: { gap: t.spacing.xxs },
    forgot: { alignSelf: 'flex-end' },
  }));
  const { values, setField, errors, validate, applyError } = useForm({ email: '', password: '' });

  const submit = () => {
    const input = validate(loginSchema);
    if (!input) return;
    // On success the session starts and the route guard navigates away.
    login.mutate(input, { onError: applyError });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      testID="login"
      footer={
        <>
          <Button label="Sign in" onPress={submit} loading={login.isPending} testID="login-submit" />
          <AuthFooterLink prompt="New to NEXT STRIDE?" action="Create account" onPress={() => router.replace('/register')} />
        </>
      }
    >
      {params.reset ? <Banner tone="success" message="Password updated. Sign in with your new password." /> : <SessionNotice />}
      {errors.form ? <Banner message={errors.form} /> : null}
      <TextField
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
        testID="login-email"
      />
      <View style={styles.passwordBlock}>
        <TextField
          ref={passwordRef}
          label="Password"
          leftIcon="lock"
          password
          value={values.password}
          onChangeText={(text) => setField('password', text)}
          error={errors.password}
          placeholder="Your password"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          testID="login-password"
        />
        <View style={styles.forgot}>
          <Button label="Forgot password?" variant="text" onPress={() => router.push('/forgot-password')} />
        </View>
      </View>
    </AuthLayout>
  );
}

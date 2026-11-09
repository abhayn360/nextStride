import { resetPasswordSchema } from '@next-stride/shared';
import { router, useLocalSearchParams } from 'expo-router';

import { Banner, Button, TextField } from '@/components/ui';
import { useResetPassword } from '@/hooks/use-auth';
import { useForm } from '@/hooks/use-form';

import { AuthLayout } from './AuthLayout';

/** Reached from the emailed deep link (nextstride://reset-password?token=…) or by pasting the code. */
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const reset = useResetPassword();
  const fromLink = Boolean(params.token);
  const { values, setField, errors, setErrors, validate, applyError } = useForm({
    token: params.token ?? '',
    password: '',
    confirm: '',
  });

  const submit = () => {
    if (values.password !== values.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    const input = validate(resetPasswordSchema, { token: values.token.trim(), password: values.password });
    if (!input) return;
    reset.mutate(input, {
      onSuccess: () => router.replace({ pathname: '/login', params: { reset: '1' } }),
      onError: applyError,
    });
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Signing in with the new password will end every other session."
      testID="reset"
      footer={<Button label="Update password" onPress={submit} loading={reset.isPending} testID="reset-submit" />}
    >
      {errors.form ? <Banner message={errors.form} /> : null}
      {errors.token ? <Banner message={errors.token} /> : null}
      {!fromLink ? (
        <TextField
          label="Reset code"
          leftIcon="key"
          value={values.token}
          onChangeText={(text) => setField('token', text)}
          placeholder="Paste the code from your email"
          autoCapitalize="none"
          autoCorrect={false}
          testID="reset-token"
        />
      ) : null}
      <TextField
        label="New password"
        leftIcon="lock"
        password
        value={values.password}
        onChangeText={(text) => setField('password', text)}
        error={errors.password}
        helper="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        textContentType="newPassword"
        testID="reset-password"
      />
      <TextField
        label="Confirm password"
        leftIcon="lock"
        password
        value={values.confirm}
        onChangeText={(text) => setField('confirm', text)}
        error={errors.confirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        testID="reset-confirm"
      />
    </AuthLayout>
  );
}

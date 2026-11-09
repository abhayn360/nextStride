import { forgotPasswordSchema } from '@next-stride/shared';
import { router } from 'expo-router';

import { Banner, Button, EmptyState, TextField } from '@/components/ui';
import { useForgotPassword } from '@/hooks/use-auth';
import { useForm } from '@/hooks/use-form';

import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordScreen() {
  const forgot = useForgotPassword();
  const { values, setField, errors, validate, applyError } = useForm({ email: '' });

  const submit = () => {
    const input = validate(forgotPasswordSchema);
    if (!input) return;
    forgot.mutate(input, { onError: applyError });
  };

  if (forgot.isSuccess) {
    return (
      <AuthLayout
        title="Check your inbox"
        testID="forgot-sent"
        footer={
          <>
            <Button label="Back to sign in" onPress={() => router.replace('/login')} />
            <Button label="I have a reset code" variant="text" onPress={() => router.push('/reset-password')} />
          </>
        }
      >
        <EmptyState
          icon="mail"
          title={`If an account exists for ${values.email.trim().toLowerCase()}, we've sent a reset link.`}
          message="The link expires in 30 minutes. Open it on this phone to choose a new password."
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
      testID="forgot"
      footer={<Button label="Send reset link" onPress={submit} loading={forgot.isPending} testID="forgot-submit" />}
    >
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
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus
        testID="forgot-email"
      />
    </AuthLayout>
  );
}

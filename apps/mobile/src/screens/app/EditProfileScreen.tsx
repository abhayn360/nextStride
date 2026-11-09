import { type UpdateProfileInput, updateProfileSchema } from '@next-stride/shared';
import { router } from 'expo-router';
import { View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { profileFormFromUser, profileFormToInput } from '@/components/profile/profile-form';
import {
  BioField,
  BodyMetricsFields,
  DateOfBirthField,
  DistancePicker,
  ExperiencePicker,
  GenderPicker,
  GoalsPicker,
  type ProfileFormValues,
} from '@/components/profile/ProfileFields';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { useForm } from '@/hooks/use-form';
import { useUpdateProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/store/auth.store';
import { useThemedStyles } from '@/theme';

interface EditFormValues extends ProfileFormValues {
  fullName: string;
  username: string;
  email: string;
  currentPassword: string;
}

/** Only send what changed, so untouched fields are never overwritten. */
function diff(next: UpdateProfileInput, previous: UpdateProfileInput): UpdateProfileInput {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(value) !== JSON.stringify(previous[key as keyof UpdateProfileInput])) changed[key] = value;
  }
  return changed as UpdateProfileInput;
}

export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const update = useUpdateProfile();
  const initial: EditFormValues = {
    ...profileFormFromUser(user),
    fullName: user?.profile.fullName ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    currentPassword: '',
  };
  const { values, setField, errors, setErrors, validate, applyError } = useForm<EditFormValues>(initial);

  const styles = useThemedStyles((t) => ({
    section: { gap: t.spacing.lg },
    center: { alignItems: 'center' },
  }));

  if (!user) return null;
  const emailChanged = values.email.trim().toLowerCase() !== user.email;

  const toInput = (form: EditFormValues): UpdateProfileInput => ({
    fullName: form.fullName,
    username: form.username,
    email: form.email,
    ...profileFormToInput(form),
  });

  const save = () => {
    const changes = diff(toInput(values), toInput(initial));
    if (Object.keys(changes).length === 0) {
      router.back();
      return;
    }
    const payload = emailChanged ? { ...changes, currentPassword: values.currentPassword } : changes;
    const parsed = validate(updateProfileSchema, payload);
    if (!parsed) return;
    if (emailChanged && !values.currentPassword) {
      setErrors({ currentPassword: 'Enter your current password to change your email' });
      return;
    }
    update.mutate(parsed, { onSuccess: () => router.back(), onError: applyError });
  };

  return (
    <Screen
      keyboard
      testID="edit-profile"
      header={<ScreenHeader title="Edit profile" />}
      footer={<Button label="Save changes" onPress={save} loading={update.isPending} testID="edit-save" />}
    >
      {errors.form ? <Banner message={errors.form} /> : null}

      <View style={styles.center}>
        <AvatarPicker name={values.fullName || user.profile.fullName} uri={user.profile.avatarUrl} />
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="secondary">
          Account
        </Text>
        <TextField
          label="Full name"
          value={values.fullName}
          onChangeText={(text) => setField('fullName', text)}
          error={errors.fullName}
          autoCapitalize="words"
          textContentType="name"
          testID="edit-name"
        />
        <TextField
          label="Username"
          leftIcon="at-sign"
          value={values.username}
          onChangeText={(text) => setField('username', text.toLowerCase().replace(/\s/g, ''))}
          error={errors.username}
          autoCapitalize="none"
          autoCorrect={false}
          testID="edit-username"
        />
        <TextField
          label="Email"
          leftIcon="mail"
          value={values.email}
          onChangeText={(text) => setField('email', text)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          testID="edit-email"
        />
        {emailChanged ? (
          <TextField
            label="Current password"
            leftIcon="lock"
            password
            value={values.currentPassword}
            onChangeText={(text) => setField('currentPassword', text)}
            error={errors.currentPassword}
            helper="Required to change the email you sign in with."
            autoComplete="current-password"
            testID="edit-current-password"
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="secondary">
          About you
        </Text>
        <DateOfBirthField value={values.dateOfBirth} error={errors.dateOfBirth} setField={setField} />
        <BodyMetricsFields values={values} errors={errors} setField={setField} />
        <GenderPicker value={values.gender} setField={setField} />
        <BioField value={values.bio} error={errors.bio} setField={setField} />
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="secondary">
          Running
        </Text>
        <ExperiencePicker value={values.runningExperience} error={errors.runningExperience} setField={setField} />
        <DistancePicker value={values.preferredDistance} error={errors.preferredDistance} setField={setField} />
        <GoalsPicker value={values.fitnessGoals} error={errors.fitnessGoals} setField={setField} />
      </View>
    </Screen>
  );
}

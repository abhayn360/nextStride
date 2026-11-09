import { profileSetupSchema } from '@next-stride/shared';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

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
  PrivateNote,
} from '@/components/profile/ProfileFields';
import { Banner, Button, ProgressBar, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/use-form';
import { useUpdateProfile } from '@/hooks/use-profile';
import { firstName } from '@/lib/format';
import { session } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { useThemedStyles } from '@/theme';

const STEPS = [
  {
    title: 'About you',
    subtitle: 'A few basics to personalise NEXT STRIDE.',
    schema: profileSetupSchema.pick({ dateOfBirth: true, heightCm: true, weightKg: true, gender: true }),
  },
  {
    title: 'Your running',
    subtitle: 'Tell us where you are today.',
    schema: profileSetupSchema.pick({ runningExperience: true, preferredDistance: true }),
  },
  {
    title: 'Your goals',
    subtitle: 'What are you running for?',
    schema: profileSetupSchema.pick({ fitnessGoals: true, bio: true }),
  },
] as const;

export default function ProfileSetupScreen() {
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = useState(0);
  const update = useUpdateProfile();
  const form = useForm(profileFormFromUser(user));
  const { values, setField, errors, validate, applyError } = form;

  const styles = useThemedStyles((t) => ({
    progress: { gap: t.spacing.xs },
    heading: { gap: t.spacing.xs },
    step: { gap: t.spacing.xl },
    center: { alignItems: 'center' },
  }));

  if (!user) return null;
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const next = () => {
    const input = profileFormToInput(values);
    if (!validate(current.schema, input)) return;
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    const complete = validate(profileSetupSchema, input);
    if (!complete) return;
    // Once the profile is complete the route guard opens the app.
    update.mutate(complete, { onError: applyError });
  };

  return (
    <Screen
      keyboard
      testID="profile-setup"
      header={
        <ScreenHeader
          back={step > 0}
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          right={step === 0 ? <Button label="Sign out" variant="text" onPress={() => void session.signOut()} /> : undefined}
        />
      }
      footer={
        <Button
          label={isLast ? 'Finish setup' : 'Continue'}
          rightIcon={isLast ? 'check' : 'arrow-right'}
          onPress={next}
          loading={update.isPending}
          testID="setup-next"
        />
      }
    >
      <View style={styles.progress}>
        <ProgressBar progress={(step + 1) / STEPS.length} accessibilityLabel="Profile setup progress" />
        <Text variant="caption" tone="secondary">
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      <View style={styles.heading}>
        <Text variant="title">{step === 0 ? `Welcome, ${firstName(user.profile.fullName)}` : current.title}</Text>
        <Text variant="body" tone="secondary">
          {current.subtitle}
        </Text>
      </View>

      {errors.form ? <Banner message={errors.form} /> : null}

      <Animated.View key={step} entering={FadeInRight.duration(280)} exiting={FadeOutLeft.duration(180)} style={styles.step}>
        {step === 0 ? (
          <>
            <View style={styles.center}>
              <AvatarPicker name={user.profile.fullName} uri={user.profile.avatarUrl} />
            </View>
            <DateOfBirthField value={values.dateOfBirth} error={errors.dateOfBirth} setField={setField} />
            <BodyMetricsFields values={values} errors={errors} setField={setField} />
            <GenderPicker value={values.gender} setField={setField} />
            <PrivateNote />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <ExperiencePicker value={values.runningExperience} error={errors.runningExperience} setField={setField} />
            <DistancePicker value={values.preferredDistance} error={errors.preferredDistance} setField={setField} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <GoalsPicker value={values.fitnessGoals} error={errors.fitnessGoals} setField={setField} />
            <BioField value={values.bio} error={errors.bio} setField={setField} />
          </>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

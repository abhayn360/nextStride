import {
  BIO_MAX_LENGTH,
  FITNESS_GOAL_LABELS,
  FITNESS_GOALS,
  type FitnessGoal,
  type Gender,
  GENDER_LABELS,
  GENDERS,
  PREFERRED_DISTANCE_LABELS,
  PREFERRED_DISTANCES,
  type PreferredDistance,
  RUNNING_EXPERIENCE_LABELS,
  RUNNING_EXPERIENCES,
  type RunningExperience,
} from '@next-stride/shared';
import { View } from 'react-native';

import { Chip, ChipGroup, Icon, OptionCard, Text, TextField } from '@/components/ui';
import { maskDateInput } from '@/lib/format';
import { useThemedStyles } from '@/theme';

/** Editable profile values as held in form state (numbers as typed strings). */
export interface ProfileFormValues extends Record<string, unknown> {
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  gender: Gender | null;
  runningExperience: RunningExperience | null;
  preferredDistance: PreferredDistance | null;
  fitnessGoals: FitnessGoal[];
  bio: string;
}

type Errors = Partial<Record<string, string>>;
type SetField = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;

export function FieldGroup({ title, description, error, children }: { title: string; description?: string; error?: string; children: React.ReactNode }) {
  const styles = useThemedStyles((t) => ({
    root: { gap: t.spacing.sm },
    head: { gap: t.spacing.xxs },
  }));
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="cardTitle">{title}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text variant="caption" tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function PrivateNote() {
  const styles = useThemedStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  }));
  return (
    <View style={styles.row}>
      <Icon name="lock" size={14} color="textMuted" />
      <Text variant="caption" tone="muted">
        Private by default — only you can see this. Change it any time in Settings.
      </Text>
    </View>
  );
}

export function DateOfBirthField({ value, error, setField }: { value: string; error?: string; setField: SetField }) {
  return (
    <TextField
      label="Date of birth"
      leftIcon="calendar"
      value={value}
      onChangeText={(text) => setField('dateOfBirth', maskDateInput(text))}
      error={error}
      helper={error ? undefined : 'YYYY-MM-DD'}
      placeholder="1994-05-12"
      keyboardType="number-pad"
      maxLength={10}
      testID="field-dob"
    />
  );
}

export function BodyMetricsFields({ values, errors, setField }: { values: ProfileFormValues; errors: Errors; setField: SetField }) {
  const styles = useThemedStyles((t) => ({ row: { flexDirection: 'row', gap: t.spacing.sm }, cell: { flex: 1 } }));
  const unit = (label: string) => (
    <Text variant="label" tone="muted">
      {label}
    </Text>
  );
  return (
    <View style={styles.row}>
      <View style={styles.cell}>
        <TextField
          label="Height (optional)"
          value={values.heightCm}
          onChangeText={(text) => setField('heightCm', text.replace(/[^0-9.,]/g, ''))}
          error={errors.heightCm}
          keyboardType="decimal-pad"
          placeholder="172"
          trailing={unit('cm')}
          maxLength={5}
          testID="field-height"
        />
      </View>
      <View style={styles.cell}>
        <TextField
          label="Weight (optional)"
          value={values.weightKg}
          onChangeText={(text) => setField('weightKg', text.replace(/[^0-9.,]/g, ''))}
          error={errors.weightKg}
          keyboardType="decimal-pad"
          placeholder="64"
          trailing={unit('kg')}
          maxLength={5}
          testID="field-weight"
        />
      </View>
    </View>
  );
}

export function GenderPicker({ value, setField }: { value: Gender | null; setField: SetField }) {
  return (
    <FieldGroup title="Gender (optional)">
      <ChipGroup>
        {GENDERS.map((gender) => (
          <Chip
            key={gender}
            label={GENDER_LABELS[gender]}
            selected={value === gender}
            onPress={() => setField('gender', value === gender ? null : gender)}
          />
        ))}
      </ChipGroup>
    </FieldGroup>
  );
}

export function ExperiencePicker({ value, error, setField }: { value: RunningExperience | null; error?: string; setField: SetField }) {
  const styles = useThemedStyles((t) => ({ list: { gap: t.spacing.xs } }));
  return (
    <FieldGroup title="Running experience" description="So we can pitch goals at the right level." error={error}>
      <View style={styles.list} accessibilityRole="radiogroup">
        {RUNNING_EXPERIENCES.map((experience) => (
          <OptionCard
            key={experience}
            title={RUNNING_EXPERIENCE_LABELS[experience].label}
            description={RUNNING_EXPERIENCE_LABELS[experience].description}
            selected={value === experience}
            onPress={() => setField('runningExperience', experience)}
            testID={`experience-${experience}`}
          />
        ))}
      </View>
    </FieldGroup>
  );
}

export function DistancePicker({ value, error, setField }: { value: PreferredDistance | null; error?: string; setField: SetField }) {
  return (
    <FieldGroup title="Preferred distance" error={error}>
      <ChipGroup>
        {PREFERRED_DISTANCES.map((distance) => (
          <Chip
            key={distance}
            label={PREFERRED_DISTANCE_LABELS[distance]}
            selected={value === distance}
            onPress={() => setField('preferredDistance', distance)}
            testID={`distance-${distance}`}
          />
        ))}
      </ChipGroup>
    </FieldGroup>
  );
}

export function GoalsPicker({ value, error, setField }: { value: FitnessGoal[]; error?: string; setField: SetField }) {
  const toggle = (goal: FitnessGoal) =>
    setField('fitnessGoals', value.includes(goal) ? value.filter((g) => g !== goal) : [...value, goal]);
  return (
    <FieldGroup title="Fitness goals" description="Choose all that apply." error={error}>
      <ChipGroup>
        {FITNESS_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={FITNESS_GOAL_LABELS[goal]}
            selected={value.includes(goal)}
            onPress={() => toggle(goal)}
            testID={`goal-${goal}`}
          />
        ))}
      </ChipGroup>
    </FieldGroup>
  );
}

export function BioField({ value, error, setField }: { value: string; error?: string; setField: SetField }) {
  return (
    <TextField
      label="Bio (optional)"
      value={value}
      onChangeText={(text) => setField('bio', text)}
      error={error}
      helper={`${value.length}/${BIO_MAX_LENGTH}`}
      placeholder="Chasing a sub-25 5K. Early mornings by the river."
      multiline
      maxLength={BIO_MAX_LENGTH}
      testID="field-bio"
    />
  );
}

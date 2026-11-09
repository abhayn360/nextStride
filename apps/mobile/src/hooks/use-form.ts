import { useCallback, useState } from 'react';
import type { z } from 'zod';

import { isApiError } from '@/services/api/client';

export type FormErrors<T> = Partial<Record<keyof T | 'form', string>>;

/**
 * Minimal form state with Zod validation (the same schemas the API uses)
 * and mapping of server-side field errors back onto inputs.
 */
export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] || current.form ? { ...current, [key]: undefined, form: undefined } : current));
  }, []);

  /** Returns parsed data, or null after populating `errors`. */
  const validate = useCallback(
    <S extends z.ZodType>(schema: S, input: unknown = values): z.infer<S> | null => {
      const result = schema.safeParse(input);
      if (result.success) {
        setErrors({});
        return result.data;
      }
      const next: FormErrors<T> = {};
      for (const issue of result.error.issues) {
        const key = (issue.path[0] ?? 'form') as keyof T | 'form';
        next[key] ??= issue.message;
      }
      setErrors(next);
      return null;
    },
    [values],
  );

  /** Shows API errors: field errors next to their inputs, everything else as a form-level banner. */
  const applyError = useCallback((error: unknown) => {
    if (isApiError(error) && error.fields) {
      const next: FormErrors<T> = {};
      for (const [field, messages] of Object.entries(error.fields)) {
        const key = (field.split('.')[0] ?? 'form') as keyof T | 'form';
        next[key] ??= messages[0];
      }
      setErrors(next);
      return;
    }
    setErrors({ form: isApiError(error) ? error.message : 'Something went wrong. Please try again.' } as FormErrors<T>);
  }, []);

  return { values, setValues, setField, errors, setErrors, validate, applyError };
}

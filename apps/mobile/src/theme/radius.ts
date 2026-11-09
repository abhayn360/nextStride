export const radius = {
  button: 10,
  input: 12,
  card: 16,
  cardLarge: 20,
  modal: 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;

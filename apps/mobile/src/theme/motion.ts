import { Easing } from 'react-native-reanimated';

/** Restrained motion: short, eased, never bouncy for core UI. */
export const motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
    reveal: 700,
  },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    decelerate: Easing.out(Easing.cubic),
  },
  spring: { damping: 18, stiffness: 180, mass: 1 },
} as const;

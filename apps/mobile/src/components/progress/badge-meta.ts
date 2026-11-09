import type { BadgeCategory, BadgeTier } from '@next-stride/shared';

import type { IconName } from '@/components/ui';
import type { ColorTokens } from '@/theme';

export const BADGE_ICONS: Record<BadgeCategory, IconName> = {
  milestones: 'flag',
  volume: 'globe',
  consistency: 'zap',
  speed: 'wind',
  lifestyle: 'sun',
};

export const TIER_COLORS: Record<BadgeTier, keyof ColorTokens> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
};

export const TIER_LABELS: Record<BadgeTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

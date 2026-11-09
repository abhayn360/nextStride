import type { LoadStatus, TrainingReport } from '@next-stride/shared';

import type { IconName } from '@/components/ui';
import type { ColorTokens } from '@/theme';

export const LOAD_META: Record<LoadStatus, { title: string; short: string; icon: IconName; color: keyof ColorTokens }> = {
  building: { title: 'Still learning your baseline', short: 'Baseline building', icon: 'clock', color: 'textSecondary' },
  low: { title: 'Lighter than usual', short: 'Load is light', icon: 'trending-down', color: 'info' },
  steady: { title: 'Load is steady', short: 'Load is steady', icon: 'check-circle', color: 'success' },
  elevated: { title: 'Load is climbing', short: 'Load is climbing', icon: 'trending-up', color: 'warning' },
  high: { title: 'Load jumped quickly', short: 'Load jumped quickly', icon: 'alert-triangle', color: 'errorText' },
};

export function loadMessage({ ratio, status }: TrainingReport['loadTrend']): string {
  const above = ratio !== null ? Math.round((ratio - 1) * 100) : 0;
  switch (status) {
    case 'building':
      return 'After a few more runs we can compare each week with your last month.';
    case 'low':
      return 'You are below your recent average. That is fine for recovery or tapering.';
    case 'steady':
      return 'This week is in line with your last 4 weeks.';
    case 'elevated':
      return `You are ${above}% above your usual week. Keep your next run or two easy.`;
    case 'high':
      return `You are ${above}% above your usual week. Jumps this big are linked to overuse injuries, so consider a rest day or an easy few days.`;
  }
}

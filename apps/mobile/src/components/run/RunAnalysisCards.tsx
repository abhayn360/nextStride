import {
  PACE_ZONES,
  paceZone,
  paceZoneRange,
  type PaceZoneDefinition,
  type PaceZoneNumber,
  type RunAnalysis,
  type ThresholdPace,
} from '@next-stride/shared';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { formatDuration, formatPace } from '@/lib/format';
import { type ColorTokens, useTheme, useThemedStyles } from '@/theme';

const zoneColor = (zone: PaceZoneNumber) => `zone${zone}` as keyof ColorTokens;

function zoneRangeLabel(definition: PaceZoneDefinition, thresholdPace: number): string {
  const { slowest, fastest } = paceZoneRange(definition, thresholdPace);
  if (slowest === null) return `Slower than ${formatPace(fastest)} /km`;
  if (fastest === null) return `Faster than ${formatPace(slowest)} /km`;
  return `${formatPace(fastest)}–${formatPace(slowest)} /km`;
}

const THRESHOLD_SOURCE_COPY: Record<ThresholdPace['source'], string> = {
  history: 'from your recent runs',
  experience: 'from your experience level until you have 3 runs of 3 km or more',
  default: 'a typical value until you have 3 runs of 3 km or more',
};

/** Time per pace zone: a stacked bar for the shape of the run, then the exact numbers. */
export function ZoneBreakdownCard({ analysis, source }: { analysis: RunAnalysis; source: ThresholdPace['source'] }) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    section: { gap: t.spacing.sm },
    body: { gap: t.spacing.md },
    bar: { flexDirection: 'row', height: 14, borderRadius: t.radius.pill, overflow: 'hidden', gap: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    chip: { width: 32, height: 24, borderRadius: t.radius.button, alignItems: 'center', justifyContent: 'center' },
    chipText: { color: theme.colors.onAccent },
    name: { flex: 1, gap: 1 },
    numbers: { alignItems: 'flex-end', gap: 1 },
  }));
  const { zones } = analysis.zones;
  const threshold = analysis.thresholdPaceSecondsPerKm;

  return (
    <View style={styles.section} testID="activity-zones">
      <Text variant="section">Pace zones</Text>
      <Card style={styles.body}>
        <View style={styles.bar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {zones
            .filter((zone) => zone.seconds > 0)
            .map((zone) => (
              <View key={zone.zone} style={{ flex: zone.seconds, backgroundColor: theme.colors[zoneColor(zone.zone)] }} />
            ))}
        </View>
        {zones.map((zone) => {
          const definition = PACE_ZONES[zone.zone - 1]!;
          const percent = Math.round(zone.fraction * 100);
          return (
            <View
              key={zone.zone}
              style={styles.row}
              accessible
              accessibilityLabel={`Zone ${zone.zone}, ${definition.name}: ${formatDuration(zone.seconds)}, ${percent} percent`}
              testID={`zone-row-${zone.zone}`}
            >
              <View style={[styles.chip, { backgroundColor: theme.colors[zoneColor(zone.zone)] }]}>
                <Text variant="label" style={styles.chipText}>
                  Z{zone.zone}
                </Text>
              </View>
              <View style={styles.name}>
                <Text variant="label">{definition.name}</Text>
                <Text variant="caption" tone="muted" tabular>
                  {zoneRangeLabel(definition, threshold)}
                </Text>
              </View>
              <View style={styles.numbers}>
                <Text variant="label" tabular>
                  {formatDuration(zone.seconds)}
                </Text>
                <Text variant="caption" tone="secondary" tabular>
                  {percent}%
                </Text>
              </View>
            </View>
          );
        })}
        <Text variant="caption" tone="muted">
          Zones are based on pace, not heart rate. Your threshold pace of {formatPace(threshold)} /km is {THRESHOLD_SOURCE_COPY[source]}.
        </Text>
      </Card>
    </View>
  );
}

const PACING_TITLE = { negative: 'Negative split', even: 'Even pacing', positive: 'Positive split' } as const;

function pacingDetail(pacing: NonNullable<RunAnalysis['pacing']>): string {
  if (pacing.kind === 'even') return 'You held a steady pace from start to finish.';
  const percent = Math.abs(pacing.deltaPercent);
  return pacing.kind === 'negative' ? `Second half ${percent}% faster. Strong finish.` : `Second half ${percent}% slower.`;
}

export function RunInsightsCard({ analysis }: { analysis: RunAnalysis }) {
  const styles = useThemedStyles((t) => ({
    section: { gap: t.spacing.sm },
    body: { gap: t.spacing.lg },
    block: { gap: t.spacing.xxs },
    rows: { gap: t.spacing.xs },
  }));
  const { focus, pacing } = analysis;
  if (!focus && !pacing) return null;

  return (
    <View style={styles.section} testID="activity-insights">
      <Text variant="section">Insights</Text>
      <Card style={styles.body}>
        {focus ? (
          <View style={styles.block}>
            <Text variant="cardTitle">{focus.label}</Text>
            <Text variant="body" tone="secondary">
              {focus.summary}
            </Text>
          </View>
        ) : null}
        {pacing ? (
          <View style={styles.block}>
            <Text variant="cardTitle">{PACING_TITLE[pacing.kind]}</Text>
            <Text variant="body" tone="secondary">
              {pacingDetail(pacing)}
            </Text>
            <View style={styles.rows}>
              <InsightRow label="First half" value={`${formatPace(pacing.firstHalfPaceSecondsPerKm)} /km`} />
              <InsightRow label="Second half" value={`${formatPace(pacing.secondHalfPaceSecondsPerKm)} /km`} />
              {pacing.splitVariationSeconds !== null ? <InsightRow label="Split variation" value={`±${pacing.splitVariationSeconds} s/km`} /> : null}
            </View>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(() => ({ row: { flexDirection: 'row', justifyContent: 'space-between' } }));
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <Text variant="label" tabular>
        {value}
      </Text>
    </View>
  );
}

export function BestEffortsCard({ analysis }: { analysis: RunAnalysis }) {
  const styles = useThemedStyles((t) => ({
    section: { gap: t.spacing.sm },
    body: { gap: t.spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center' },
    label: { flex: 1 },
    time: { width: 84, textAlign: 'right' },
    pace: { width: 84, textAlign: 'right' },
  }));
  if (analysis.bestEfforts.length === 0) return null;

  return (
    <View style={styles.section} testID="activity-best-efforts">
      <Text variant="section">Best efforts</Text>
      <Card style={styles.body}>
        {analysis.bestEfforts.map((effort) => (
          <View key={effort.meters} style={styles.row} accessible accessibilityLabel={`${effort.label}: ${formatDuration(effort.seconds)}`}>
            <Text variant="body" tone="secondary" style={styles.label}>
              {effort.label}
            </Text>
            <Text variant="label" tabular style={styles.time}>
              {formatDuration(effort.seconds)}
            </Text>
            <Text variant="caption" tone="muted" tabular style={styles.pace}>
              {formatPace(effort.paceSecondsPerKm)} /km
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

/** Live zone during a run. Always rendered while recording, so the panel doesn't jump. */
export function LiveZone({ paceSecondsPerKm, thresholdPace }: { paceSecondsPerKm: number | null; thresholdPace: number }) {
  const theme = useTheme();
  const styles = useThemedStyles((t) => ({
    root: { alignItems: 'center', gap: t.spacing.xxs },
    segments: { flexDirection: 'row', gap: 4 },
    segment: { width: 36, height: 6, borderRadius: t.radius.pill },
  }));
  const zone = paceSecondsPerKm ? paceZone(paceSecondsPerKm, thresholdPace) : null;
  const label = zone ? `Zone ${zone} · ${PACE_ZONES[zone - 1]!.name}` : 'Finding your zone';

  return (
    <View style={styles.root} accessible accessibilityLabel={label} testID="run-live-zone">
      <View style={styles.segments}>
        {PACE_ZONES.map((definition) => (
          <View
            key={definition.zone}
            style={[styles.segment, { backgroundColor: definition.zone === zone ? theme.colors[zoneColor(definition.zone)] : theme.colors.border }]}
          />
        ))}
      </View>
      <Text variant="caption" tone={zone ? 'primary' : 'muted'}>
        {label}
      </Text>
    </View>
  );
}

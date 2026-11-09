/**
 * Decides what the voice coach says during a run. It only produces text, so it
 * can be tested without audio; the app decides how to speak it.
 */

import { paceZone, type PaceZoneNumber } from './run-analysis';

export const VOICE_COACH = {
  /** Over the ceiling for this long before speaking, so a brief GPS wobble stays quiet. */
  zoneSustainMs: 45_000,
  /** Minimum time between zone alerts. */
  zoneCooldownMs: 180_000,
  /** A gap between samples this long (a pause) restarts the sustain timer. */
  sampleGapMs: 10_000,
} as const;

export interface VoiceCoachSettings {
  splits: boolean;
  /** Alert above this zone; null turns zone alerts off. */
  zoneCeiling: PaceZoneNumber | null;
}

export interface VoiceCoachSample {
  now: number;
  distanceMeters: number;
  movingSeconds: number;
  currentPaceSecondsPerKm: number | null;
  thresholdPaceSecondsPerKm: number;
}

/** 342 → "5 minutes 42 seconds". */
export function spokenDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

export class VoiceCoach {
  private lastKm = 0;
  /** Moving time at the last announced kilometre; null when the split can't be known. */
  private lastKmMovingSeconds: number | null = 0;
  private overCeilingSince: number | null = null;
  private lastAlertAt: number | null = null;
  private lastSampleAt: number | null = null;

  /**
   * Continues a run restored after the app closed. Kilometres already covered
   * aren't repeated, and the next split is left out because its start is unknown.
   */
  resume(distanceMeters: number): void {
    this.lastKm = Math.floor(distanceMeters / 1000);
    this.lastKmMovingSeconds = null;
  }

  update(sample: VoiceCoachSample, settings: VoiceCoachSettings): string[] {
    const messages: string[] = [];
    const split = this.checkSplit(sample);
    if (split && settings.splits) messages.push(split);
    const alert = this.checkZone(sample, settings.zoneCeiling);
    if (alert) messages.push(alert);
    this.lastSampleAt = sample.now;
    return messages;
  }

  private checkSplit({ distanceMeters, movingSeconds }: VoiceCoachSample): string | null {
    const km = Math.floor(distanceMeters / 1000);
    if (km <= this.lastKm) return null;

    const parts = [`Kilometre ${km}.`];
    if (this.lastKmMovingSeconds !== null) {
      // GPS can arrive in batches that cross more than one kilometre.
      const split = (movingSeconds - this.lastKmMovingSeconds) / (km - this.lastKm);
      if (split > 0) parts.push(`Split, ${spokenDuration(split)}.`);
    }
    parts.push(`Average pace, ${spokenDuration(movingSeconds / km)} per kilometre.`);

    this.lastKm = km;
    this.lastKmMovingSeconds = movingSeconds;
    return parts.join(' ');
  }

  private checkZone(sample: VoiceCoachSample, ceiling: PaceZoneNumber | null): string | null {
    const { now, currentPaceSecondsPerKm: pace, thresholdPaceSecondsPerKm: threshold } = sample;
    const interrupted = this.lastSampleAt !== null && now - this.lastSampleAt > VOICE_COACH.sampleGapMs;
    const zone = pace ? paceZone(pace, threshold) : null;

    if (ceiling === null || zone === null || zone <= ceiling || interrupted) {
      this.overCeilingSince = zone !== null && ceiling !== null && zone > ceiling ? now : null;
      return null;
    }

    this.overCeilingSince ??= now;
    if (now - this.overCeilingSince < VOICE_COACH.zoneSustainMs) return null;
    if (this.lastAlertAt !== null && now - this.lastAlertAt < VOICE_COACH.zoneCooldownMs) return null;

    this.lastAlertAt = now;
    return `Ease back, you're in zone ${zone}.`;
  }
}

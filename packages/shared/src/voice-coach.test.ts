import { describe, expect, it } from 'vitest';

import { spokenDuration, VOICE_COACH, VoiceCoach, type VoiceCoachSample, type VoiceCoachSettings } from './voice-coach';

const THRESHOLD = 300;
const Z2 = 375;
const Z4 = 305;
const all: VoiceCoachSettings = { splits: true, zoneCeiling: 3 };

const sample = (overrides: Partial<VoiceCoachSample>): VoiceCoachSample => ({
  now: 0,
  distanceMeters: 0,
  movingSeconds: 0,
  currentPaceSecondsPerKm: null,
  thresholdPaceSecondsPerKm: THRESHOLD,
  ...overrides,
});

/** Feeds one sample per second at a pace from `fromMs`, returning everything said. */
function hold(coach: VoiceCoach, pace: number | null, seconds: number, fromMs = 0, settings = all): string[] {
  const said: string[] = [];
  for (let s = 0; s <= seconds; s += 1) said.push(...coach.update(sample({ now: fromMs + s * 1000, currentPaceSecondsPerKm: pace }), settings));
  return said;
}

describe('spokenDuration', () => {
  it('reads naturally', () => {
    expect(spokenDuration(342)).toBe('5 minutes 42 seconds');
    expect(spokenDuration(60)).toBe('1 minute');
    expect(spokenDuration(61)).toBe('1 minute 1 second');
    expect(spokenDuration(0)).toBe('0 seconds');
  });
});

describe('kilometre splits', () => {
  it('announces each kilometre once, with its own split and the average', () => {
    const coach = new VoiceCoach();
    expect(coach.update(sample({ distanceMeters: 999, movingSeconds: 299 }), all)).toEqual([]);
    expect(coach.update(sample({ distanceMeters: 1001, movingSeconds: 300 }), all)).toEqual([
      'Kilometre 1. Split, 5 minutes. Average pace, 5 minutes per kilometre.',
    ]);
    expect(coach.update(sample({ distanceMeters: 1500, movingSeconds: 450 }), all)).toEqual([]);
    expect(coach.update(sample({ distanceMeters: 2000, movingSeconds: 620 }), all)).toEqual([
      'Kilometre 2. Split, 5 minutes 20 seconds. Average pace, 5 minutes 10 seconds per kilometre.',
    ]);
  });

  it('averages the split when a batch of GPS crosses two kilometres', () => {
    const coach = new VoiceCoach();
    expect(coach.update(sample({ distanceMeters: 2100, movingSeconds: 600 }), all)[0]).toContain('Kilometre 2. Split, 5 minutes.');
  });

  it('can be turned off without losing its place', () => {
    const coach = new VoiceCoach();
    expect(coach.update(sample({ distanceMeters: 1001, movingSeconds: 300 }), { ...all, splits: false })).toEqual([]);
    expect(coach.update(sample({ distanceMeters: 2001, movingSeconds: 600 }), all)[0]).toContain('Kilometre 2. Split, 5 minutes.');
  });

  it('does not repeat kilometres after a restored run, and skips the unknown split', () => {
    const coach = new VoiceCoach();
    coach.resume(3200);
    expect(coach.update(sample({ distanceMeters: 3900, movingSeconds: 1100 }), all)).toEqual([]);
    const [message] = coach.update(sample({ distanceMeters: 4000, movingSeconds: 1200 }), all);
    expect(message).toBe('Kilometre 4. Average pace, 5 minutes per kilometre.');
  });
});

describe('zone alerts', () => {
  it('stays quiet at or below the ceiling', () => {
    expect(hold(new VoiceCoach(), Z2, 300)).toEqual([]);
  });

  it('alerts only after holding above the ceiling, naming the zone', () => {
    const coach = new VoiceCoach();
    expect(hold(coach, Z4, VOICE_COACH.zoneSustainMs / 1000 - 1)).toEqual([]);
    expect(coach.update(sample({ now: VOICE_COACH.zoneSustainMs, currentPaceSecondsPerKm: Z4 }), all)).toEqual(["Ease back, you're in zone 4."]);
  });

  it('ignores a brief surge', () => {
    const coach = new VoiceCoach();
    hold(coach, Z4, 30);
    hold(coach, Z2, 1, 31_000);
    expect(hold(coach, Z4, 30, 33_000)).toEqual([]);
  });

  it('waits out the cooldown before repeating', () => {
    expect(hold(new VoiceCoach(), Z4, 200)).toHaveLength(1);
    expect(hold(new VoiceCoach(), Z4, 45 + 180)).toHaveLength(2);
  });

  it('restarts the timer after a pause', () => {
    const coach = new VoiceCoach();
    hold(coach, Z4, 30);
    expect(hold(coach, Z4, 30, 120_000)).toEqual([]);
  });

  it('restarts the timer when pace drops out', () => {
    const coach = new VoiceCoach();
    hold(coach, Z4, 30);
    coach.update(sample({ now: 31_000, currentPaceSecondsPerKm: null }), all);
    expect(hold(coach, Z4, 30, 32_000)).toEqual([]);
  });

  it('can be turned off, and respects a higher ceiling', () => {
    expect(hold(new VoiceCoach(), Z4, 120, 0, { splits: true, zoneCeiling: null })).toEqual([]);
    expect(hold(new VoiceCoach(), Z4, 120, 0, { splits: true, zoneCeiling: 4 })).toEqual([]);
  });
});

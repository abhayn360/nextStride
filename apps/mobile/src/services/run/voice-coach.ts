import { resolveThresholdPace, type RunStats, VoiceCoach } from '@next-stride/shared';
import * as Speech from 'expo-speech';

import { deviceTimeZone } from '@/lib/format';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth.store';
import { usePreferencesStore } from '@/store/preferences.store';

import type { RunCoach } from './run-session';

function say(text: string) {
  // A system-managed audio session mixes with the runner's music instead of stopping it.
  Speech.speak(text, { language: 'en-US', useApplicationAudioSession: false });
}

function thresholdPace(): number {
  const stats = queryClient.getQueryData<RunStats>(['runs', 'stats', deviceTimeZone()]);
  return resolveThresholdPace({
    historyPaceSecondsPerKm: stats?.zoneReferencePaceSecondsPerKm,
    experience: useAuthStore.getState().user?.profile.runningExperience ?? null,
  }).paceSecondsPerKm;
}

export function speakVoiceCoachSample() {
  say("Kilometre 1. Split, 5 minutes 30 seconds. Ease back, you're in zone 4.");
}

/** Speaks during a run. Audio problems must never affect recording, so failures are ignored. */
export function createRunVoiceCoach(): RunCoach {
  let coach = new VoiceCoach();

  return {
    start() {
      coach = new VoiceCoach();
    },
    resume(distanceMeters) {
      coach = new VoiceCoach();
      coach.resume(distanceMeters);
    },
    update({ now, distanceMeters, movingSeconds, currentSpeed }) {
      const { voiceCoachEnabled, voiceSplits, zoneAlertCeiling } = usePreferencesStore.getState();
      // Keeps counting while muted, so unmuting doesn't announce old kilometres.
      const messages = coach.update(
        {
          now,
          distanceMeters,
          movingSeconds,
          currentPaceSecondsPerKm: currentSpeed ? 1000 / currentSpeed : null,
          thresholdPaceSecondsPerKm: thresholdPace(),
        },
        { splits: voiceSplits, zoneCeiling: zoneAlertCeiling === 'off' ? null : (Number(zoneAlertCeiling) as 2 | 3 | 4) },
      );
      if (!voiceCoachEnabled) return;
      try {
        messages.forEach(say);
      } catch {
        // See above.
      }
    },
    stop() {
      void Speech.stop().catch(() => undefined);
    },
  };
}

import { gpsSignalStatus } from '@next-stride/shared';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteMap } from '@/components/map/RouteMap';
import { GpsBadge } from '@/components/run/GpsBadge';
import { HoldButton } from '@/components/run/HoldButton';
import { AppModal, Banner, Button, Icon, IconButton, ScalePressable, Text } from '@/components/ui';
import { formatDuration, formatKm, formatPace, formatSpeedKmh } from '@/lib/format';
import { ensureLocationPermission, type PermissionResult } from '@/services/location/location-tracker';
import { runSession } from '@/services/run';
import type { StartResult } from '@/services/run/run-session';
import { elapsedMs, useRunStore } from '@/store/run.store';
import { useThemedStyles } from '@/theme';

type Blocker = Exclude<StartResult, { ok: true }>['reason'];

const BLOCKER_COPY: Record<Blocker, { title: string; message: string; action: string; settings: boolean }> = {
  denied: {
    title: 'Location needed',
    message: 'NEXT STRIDE uses your location to measure the route, distance and pace of your run.',
    action: 'Allow location',
    settings: false,
  },
  blocked: {
    title: 'Location is turned off for NEXT STRIDE',
    message: 'Allow location access in Settings to track runs. Choose "While Using the App" with Precise Location on.',
    action: 'Open Settings',
    settings: true,
  },
  'services-disabled': {
    title: 'Location Services are off',
    message: 'Turn on Location Services in your device settings to track runs.',
    action: 'Open Settings',
    settings: true,
  },
  imprecise: {
    title: 'Precise location is off',
    message: 'Approximate location can be kilometres out, which makes distance and pace meaningless. Turn on Precise Location for NEXT STRIDE.',
    action: 'Open Settings',
    settings: true,
  },
  unavailable: {
    title: "Couldn't start GPS tracking",
    message: 'Location updates are unavailable right now. Please try again.',
    action: 'Try again',
    settings: false,
  },
};

const SHORT_RUN_METERS = 50;
const PREVIEW_STALE_MS = 60_000;

export default function RunScreen() {
  const insets = useSafeAreaInsets();
  const run = useRunStore();
  const [now, setNow] = useState(() => Date.now());
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ latitude: number; longitude: number; accuracy: number | null; recordedAt: number } | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | 'short' | null>(null);
  const [busy, setBusy] = useState(false);
  /** Bumped to re-run the permission check (user action, or back from Settings). */
  const [permissionCheck, setPermissionCheck] = useState(0);

  const styles = useThemedStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.background },
    map: { flex: 1 },
    topBar: { position: 'absolute', left: t.spacing.md, right: t.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    panel: {
      backgroundColor: t.colors.background,
      borderTopLeftRadius: t.radius.modal,
      borderTopRightRadius: t.radius.modal,
      marginTop: -t.radius.modal,
      paddingHorizontal: t.spacing.xl,
      paddingTop: t.spacing.lg,
      gap: t.spacing.lg,
    },
    hero: { flexDirection: 'row' },
    heroCell: { flex: 1, alignItems: 'center', gap: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: t.spacing.md },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', minHeight: 110 },
    primaryControl: { width: 84, height: 84, borderRadius: t.radius.pill, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' },
    controlLabel: { alignItems: 'center', gap: t.spacing.xs },
    countdown: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countdownText: { fontSize: 120, lineHeight: 132 },
    stack: { gap: t.spacing.md },
    blocker: { gap: t.spacing.sm },
    pausedPill: {
      alignSelf: 'center',
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xxs,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.accentSubtle,
    },
  }));

  const active = run.phase !== 'idle';

  // 1 s heartbeat: elapsed time, current-pace decay and GPS age.
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      if (active) runSession.tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // Before the run: check permission and show the current position / GPS quality.
  useEffect(() => {
    if (active) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      const permission: PermissionResult = await ensureLocationPermission();
      if (cancelled) return;
      if (!permission.granted) return setBlocker(permission.reason);
      if (!permission.precise) return setBlocker('imprecise');
      setBlocker(null);
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (location) =>
          setPreview({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            recordedAt: location.timestamp,
          }),
      );
      if (cancelled) subscription.remove();
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, permissionCheck]);

  // Coming back from Settings: check again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && blocker) setPermissionCheck((value) => value + 1);
    });
    return () => subscription.remove();
  }, [blocker]);

  // 3-2-1 countdown, then start.
  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
        return;
      }
      setCountdown(null);
      void runSession.start().then((result) => {
        if (!result.ok) setBlocker(result.reason);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [countdown]);

  const resolveBlocker = async () => {
    if (!blocker) return;
    if (BLOCKER_COPY[blocker].settings) {
      await Linking.openSettings();
      return;
    }
    setPermissionCheck((value) => value + 1);
  };

  const finish = async (force = false) => {
    if (!force && run.distanceMeters < SHORT_RUN_METERS) {
      setConfirm('short');
      return;
    }
    setBusy(true);
    const localId = await runSession.finish();
    setBusy(false);
    setConfirm(null);
    if (localId) router.replace({ pathname: '/activity/[id]', params: { id: localId } });
  };

  const discard = async () => {
    await runSession.discard();
    setConfirm(null);
    router.back();
  };

  // ---- derived live values -------------------------------------------------
  const elapsed = elapsedMs(run, now);
  const movingSeconds = run.movingTimeMs / 1000;
  const avgBasis = movingSeconds > 0 ? movingSeconds : elapsed / 1000;
  const avgSpeed = run.distanceMeters >= 10 && avgBasis > 0 ? run.distanceMeters / avgBasis : null;
  const avgPace = avgSpeed ? 1000 / avgSpeed : null;
  const currentPace = run.currentSpeed ? 1000 / run.currentSpeed : null;
  // Before starting, a stationary phone may get few updates: judge by accuracy, and only call it lost after 60 s.
  const previewGps = preview && now - preview.recordedAt > PREVIEW_STALE_MS ? 'lost' : gpsSignalStatus(preview, preview?.recordedAt ?? now);
  const gps = active ? (run.phase === 'recording' ? gpsSignalStatus(run.lastFix, now) : run.gps) : previewGps;
  const position = active ? run.lastFix : preview;
  const current = position ? ([position.longitude, position.latitude] as [number, number]) : null;

  return (
    <View style={styles.root} testID="run-screen">
      <RouteMap route={run.route} current={current} follow style={styles.map} padding={{ bottom: 64 }} testID="run-map" />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton
          icon={active ? 'chevron-down' : 'x'}
          variant="filled"
          accessibilityLabel={active ? 'Minimise — your run keeps recording' : 'Close'}
          onPress={() => router.back()}
          testID="run-close"
        />
        <GpsBadge signal={gps} />
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {run.recovered ? (
          <Banner tone="info" message="We restored your run after the app was closed. Resume or finish when you're ready." />
        ) : null}
        {active && run.trackingMode === 'foreground' ? (
          <Banner tone="info" message="Keep the app open: tracking with the screen locked needs the full NEXT STRIDE app build." />
        ) : null}
        {run.phase === 'recording' && gps === 'lost' ? (
          <Banner message="GPS signal lost. Keep going — we'll reconnect and your time keeps counting." />
        ) : null}

        {!active ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.stack}>
            {blocker ? (
              <View style={styles.blocker}>
                <Text variant="section">{BLOCKER_COPY[blocker].title}</Text>
                <Text variant="body" tone="secondary">
                  {BLOCKER_COPY[blocker].message}
                </Text>
                <Button label={BLOCKER_COPY[blocker].action} onPress={() => void resolveBlocker()} testID="run-permission" />
              </View>
            ) : (
              <>
                <View style={styles.controlLabel}>
                  <Text variant="section">Ready when you are</Text>
                  <Text variant="body" tone="secondary" align="center">
                    {gps === 'good' || gps === 'fair'
                      ? 'GPS is locked on. Distance and pace are measured from your route.'
                      : 'Waiting for a precise GPS fix. Head outside with a clear view of the sky.'}
                  </Text>
                </View>
                <View style={styles.controls}>
                  <ScalePressable
                    onPress={() => setCountdown(3)}
                    accessibilityRole="button"
                    accessibilityLabel="Start run"
                    style={styles.primaryControl}
                    testID="run-start"
                  >
                    <Text variant="button" tone="onAccent">
                      START
                    </Text>
                  </ScalePressable>
                </View>
              </>
            )}
          </Animated.View>
        ) : (
          <>
            {run.phase === 'paused' ? (
              <Animated.View entering={FadeIn} style={styles.pausedPill}>
                <Text variant="overline" tone="accent">
                  Paused
                </Text>
              </Animated.View>
            ) : null}
            <View style={styles.hero}>
              <View style={styles.heroCell}>
                <Text variant="statLarge" tabular testID="run-elapsed" accessibilityLabel={`Time ${formatDuration(elapsed / 1000)}`}>
                  {formatDuration(elapsed / 1000)}
                </Text>
                <Text variant="overline" tone="secondary">
                  Time
                </Text>
              </View>
              <View style={styles.heroCell}>
                <Text variant="statLarge" tabular testID="run-distance" accessibilityLabel={`Distance ${formatKm(run.distanceMeters)} kilometres`}>
                  {formatKm(run.distanceMeters)}
                </Text>
                <Text variant="overline" tone="secondary">
                  Kilometres
                </Text>
              </View>
            </View>

            <View style={styles.grid}>
              <Metric label="Current pace" value={formatPace(currentPace)} unit="/km" testID="run-current-pace" />
              <Metric label="Avg pace" value={formatPace(avgPace)} unit="/km" testID="run-avg-pace" />
              <Metric label="Current speed" value={formatSpeedKmh(run.currentSpeed)} unit="km/h" />
              <Metric label="Avg speed" value={formatSpeedKmh(avgSpeed)} unit="km/h" />
            </View>

            <View style={styles.controls}>
              {run.phase === 'recording' ? (
                <View style={styles.controlLabel}>
                  <ScalePressable
                    onPress={() => void runSession.pause()}
                    accessibilityRole="button"
                    accessibilityLabel="Pause run"
                    style={styles.primaryControl}
                    testID="run-pause"
                  >
                    <Icon name="pause" size={32} color="onAccent" />
                  </ScalePressable>
                  <Text variant="caption" tone="secondary">
                    Pause
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.controlLabel}>
                    <IconButton icon="trash-2" variant="filled" color="errorText" size={56} accessibilityLabel="Discard run" onPress={() => setConfirm('discard')} />
                    <Text variant="caption" tone="secondary">
                      Discard
                    </Text>
                  </View>
                  <View style={styles.controlLabel}>
                    <ScalePressable
                      onPress={() => void runSession.resume()}
                      accessibilityRole="button"
                      accessibilityLabel="Resume run"
                      style={styles.primaryControl}
                      testID="run-resume"
                    >
                      <Icon name="play" size={32} color="onAccent" />
                    </ScalePressable>
                    <Text variant="caption" tone="secondary">
                      Resume
                    </Text>
                  </View>
                  <HoldButton
                    icon="square"
                    label="Finish"
                    onComplete={() => void finish()}
                    onAccessibleActivate={() => setConfirm('finish')}
                    testID="run-finish"
                  />
                </>
              )}
            </View>
          </>
        )}
      </View>

      {countdown !== null ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.countdown} accessibilityLiveRegion="assertive">
          <Animated.View key={countdown} entering={ZoomIn.duration(300)}>
            <Text variant="hero" tone="accent" tabular style={styles.countdownText}>
              {countdown}
            </Text>
          </Animated.View>
          <Button label="Cancel" variant="text" onPress={() => setCountdown(null)} />
        </Animated.View>
      ) : null}

      <AppModal
        visible={confirm === 'finish'}
        onClose={() => setConfirm(null)}
        title="Finish run?"
        message="Your run will be saved to your activity history."
        actions={[
          { label: 'Finish and save', onPress: () => void finish(), loading: busy },
          { label: 'Keep going', variant: 'text', onPress: () => setConfirm(null) },
        ]}
      />
      <AppModal
        visible={confirm === 'short'}
        onClose={() => setConfirm(null)}
        title="Very short run"
        message={`Only ${Math.round(run.distanceMeters)} m were recorded. Save it anyway?`}
        actions={[
          { label: 'Save anyway', onPress: () => void finish(true), loading: busy },
          { label: 'Discard', variant: 'danger', onPress: () => void discard() },
          { label: 'Cancel', variant: 'text', onPress: () => setConfirm(null) },
        ]}
      />
      <AppModal
        visible={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title="Discard this run?"
        message="The route and stats will be deleted. This can't be undone."
        actions={[
          { label: 'Discard run', variant: 'danger', onPress: () => void discard() },
          { label: 'Keep run', variant: 'text', onPress: () => setConfirm(null) },
        ]}
      />
    </View>
  );
}

function Metric({ label, value, unit, testID }: { label: string; value: string; unit: string; testID?: string }) {
  const styles = useThemedStyles((t) => ({
    cell: { width: '50%', alignItems: 'center', gap: 2 },
    row: { flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.xxs },
  }));
  return (
    <View style={styles.cell} accessibilityLabel={`${label} ${value} ${unit}`} testID={testID}>
      <View style={styles.row}>
        <Text variant="section" tabular>
          {value}
        </Text>
        <Text variant="caption" tone="secondary">
          {unit}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

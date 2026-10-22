/**
 * Gesture-driven player surface (YouTube/bilibili-style) replacing
 * expo-video's native controls. Orchestrator only — gestures, HUD and
 * control bars live in sibling modules. The parent renders it absolute
 * (inline 16:9 band or fullscreen overlay); switching is a style change so
 * the native player is never recreated.
 */
import { StyledVideoView } from '@/components/native-styled';
import { haptic } from '@/lib/haptics';
import { useEvent } from 'expo';
import * as Brightness from 'expo-brightness';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerBottomBar, PlayerTopBar } from './player-control-bars';
import { PlayerHud } from './player-hud';
import { HUD_NONE, HUD_SEEK, HUD_SPEED, clamp, formatTime } from './player-shared';
import { usePlayerGestures } from './use-player-gestures';

export interface GesturePlayerProps {
  player: VideoPlayer;
  fullscreen: boolean;
  onToggleFullscreen: (next: boolean) => void;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export function GesturePlayer({
  player,
  fullscreen,
  onToggleFullscreen,
  title,
  style,
}: GesturePlayerProps) {
  const insets = useSafeAreaInsets();

  // ── Player state (event-driven) ───────────────────────────────────────────
  const timeUpdate = useEvent(player, 'timeUpdate');
  const currentTime = timeUpdate?.currentTime ?? player.currentTime;
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { volume } = useEvent(player, 'volumeChange', { volume: player.volume });

  const [duration, setDuration] = useState(player.duration ?? 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: status/currentTime are intentional triggers — duration only becomes available after the native player loads the source.
  useEffect(() => {
    const d = player.duration ?? 0;
    setDuration((prev) => (Math.abs(prev - d) > 0.5 ? d : prev));
  }, [player, status, currentTime]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [controlsVisible, setControlsVisible] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  /** Finger target shown while scrubbing (decoupled from player position). */
  const [scrubDisplay, setScrubDisplay] = useState<number | null>(null);
  const [hudMode, setHudMode] = useState(HUD_NONE);
  const [hudText, setHudText] = useState('');
  const [ripple, setRipple] = useState<{ side: 1 | -1; key: number } | null>(null);

  const scrubbingRef = useRef(false);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleKeyRef = useRef(0);
  const playerRef = useRef(player);
  playerRef.current = player;

  const controlsOpacitySV = useSharedValue(0);
  const hudOpacitySV = useSharedValue(0);

  // Written after the gesture hook runs; lets the bridge callbacks above
  // stay referentially stable.
  const hudModeSvRef = useRef<{ value: number }>({ value: HUD_NONE });
  const brightnessTouchedRef = useRef(false);

  // ── Auto-hide the control bars while playing ──────────────────────────────
  useEffect(() => {
    if (!controlsVisible || !isPlaying || scrubbing || hudMode !== HUD_NONE) return;
    const id = setTimeout(() => setControlsVisible(false), 3200);
    return () => clearTimeout(id);
  }, [controlsVisible, isPlaying, scrubbing, hudMode]);

  useEffect(() => {
    controlsOpacitySV.value = withTiming(controlsVisible ? 1 : 0, { duration: 160 });
  }, [controlsVisible, controlsOpacitySV]);

  useEffect(() => {
    hudOpacitySV.value = withTiming(hudMode !== HUD_NONE ? 1 : 0, { duration: 120 });
  }, [hudMode, hudOpacitySV]);

  // ── JS bridges called from worklets ───────────────────────────────────────
  const jsToggleControls = useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const jsTogglePlay = useCallback(() => {
    const p = playerRef.current;
    try {
      if (p.playing) p.pause();
      else p.play();
    } catch {
      // player released
    }
  }, []);

  const jsSeekTo = useCallback((t: number) => {
    const p = playerRef.current;
    try {
      p.currentTime = clamp(t, 0, p.duration ?? t);
    } catch {
      // player released
    }
  }, []);

  const jsSeekBy = useCallback((delta: number) => {
    const p = playerRef.current;
    try {
      const d = p.duration ?? 0;
      p.currentTime = clamp(p.currentTime + delta, 0, d || p.currentTime + delta);
    } catch {
      // player released
    }
    haptic();
    rippleKeyRef.current += 1;
    const key = rippleKeyRef.current;
    setRipple({ side: delta > 0 ? 1 : -1, key });
    if (rippleTimerRef.current) clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = setTimeout(() => setRipple(null), 800);
  }, []);

  const jsDoubleTap = useCallback(
    (dir: 1 | 0 | -1) => {
      if (dir === 0) jsTogglePlay();
      else jsSeekBy(dir * 10);
    },
    [jsSeekBy, jsTogglePlay]
  );

  const jsApplyVolume = useCallback((v: number) => {
    try {
      playerRef.current.volume = v;
    } catch {
      // player released
    }
  }, []);

  const jsApplyBrightness = useCallback((b: number) => {
    brightnessTouchedRef.current = true;
    Brightness.setBrightnessAsync(b).catch(() => {});
  }, []);

  const jsSetRate = useCallback((rate: number) => {
    try {
      playerRef.current.playbackRate = rate;
    } catch {
      // player released
    }
  }, []);

  const clearHud = useCallback(() => {
    setHudMode(HUD_NONE);
    hudModeSvRef.current.value = HUD_NONE;
  }, []);

  const jsScheduleHudHide = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => clearHud(), 600);
  }, [clearHud]);

  const jsHudLevel = useCallback((mode: number, level: number) => {
    setHudMode(mode);
    hudModeSvRef.current.value = mode;
    setHudText(`${Math.round(level * 100)}%`);
  }, []);

  const jsHudSpeed = useCallback(() => {
    setHudMode(HUD_SPEED);
    hudModeSvRef.current.value = HUD_SPEED;
    setHudText('2×');
  }, []);

  // ── Scrub display decoupling ───────────────────────────────────────────────
  // Displays follow the FINGER TARGET immediately; the player catches up in
  // the background. After release the target stays shown until the player
  // is close to it, so numbers never bounce backwards.
  const scrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearScrub = useCallback(() => {
    if (scrubTimerRef.current) {
      clearTimeout(scrubTimerRef.current);
      scrubTimerRef.current = null;
    }
    scrubbingRef.current = false;
    setScrubbing(false);
    setScrubDisplay(null);
  }, []);

  useEffect(() => {
    if (scrubDisplay === null) return;
    if (Math.abs(currentTime - scrubDisplay) < 0.75) clearScrub();
  }, [currentTime, scrubDisplay, clearScrub]);

  const jsScrubMove = useCallback((t: number, dur: number) => {
    scrubbingRef.current = true;
    setScrubbing(true);
    setControlsVisible(true);
    setScrubDisplay(t);
    setHudMode(HUD_SEEK);
    hudModeSvRef.current.value = HUD_SEEK;
    setHudText(`${formatTime(t)} / ${formatTime(dur)}`);
  }, []);

  const jsScrubEnd = useCallback(
    (t: number) => {
      setScrubDisplay(t);
      if (scrubTimerRef.current) clearTimeout(scrubTimerRef.current);
      scrubTimerRef.current = setTimeout(() => clearScrub(), 1200);
    },
    [clearScrub]
  );

  const jsCommitScrub = useCallback(
    (frac: number) => {
      const p = playerRef.current;
      const d = p.duration ?? 0;
      if (d > 0) {
        try {
          p.currentTime = frac * d;
        } catch {
          // player released
        }
        jsScrubEnd(frac * d);
      } else {
        clearScrub();
      }
    },
    [jsScrubEnd, clearScrub]
  );

  const jsToggleFullscreen = useCallback(
    (next: boolean) => {
      haptic();
      onToggleFullscreen(next);
    },
    [onToggleFullscreen]
  );

  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  const jsToggleFullscreenGesture = useCallback(() => {
    haptic();
    onToggleFullscreen(!fullscreenRef.current);
  }, [onToggleFullscreen]);

  // ── Gestures (also owns the shared values) ────────────────────────────────
  const cb = useMemo(
    () => ({
      jsToggleControls,
      jsDoubleTap,
      jsToggleFullscreenGesture,
      jsSetRate,
      jsHudSpeed,
      jsScheduleHudHide,
      jsHudLevel,
      jsApplyVolume,
      jsApplyBrightness,
      jsScrubMove,
      jsScrubEnd,
      jsSeekTo,
      jsCommitScrub,
    }),
    [
      jsToggleControls,
      jsDoubleTap,
      jsToggleFullscreenGesture,
      jsSetRate,
      jsHudSpeed,
      jsScheduleHudHide,
      jsHudLevel,
      jsApplyVolume,
      jsApplyBrightness,
      jsScrubMove,
      jsScrubEnd,
      jsSeekTo,
      jsCommitScrub,
    ]
  );
  const { composed, slider, sv } = usePlayerGestures(cb);

  hudModeSvRef.current = sv.hudModeSV;

  // ── Player → UI-thread mirrors ─────────────────────────────────────────────
  useEffect(() => {
    sv.currentTimeSV.value = currentTime;
    sv.durationSV.value = playerRef.current.duration ?? 0;
    if (!scrubbingRef.current) {
      const d = playerRef.current.duration ?? 0;
      sv.sliderSV.value = d > 0 ? clamp(currentTime / d, 0, 1) : 0;
    }
  }, [currentTime, sv]);

  useEffect(() => {
    sv.volumeSV.value = volume;
  }, [volume, sv]);

  // Snapshot the pre-gesture window brightness once so it can be restored
  // when leaving the screen.
  const brightnessSnapshotRef = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    Brightness.getBrightnessAsync()
      .then((b) => {
        if (!cancelled) {
          sv.brightnessSV.value = clamp(b, 0.02, 1);
          brightnessSnapshotRef.current = b;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (brightnessTouchedRef.current && brightnessSnapshotRef.current !== null) {
        Brightness.setBrightnessAsync(brightnessSnapshotRef.current).catch(() => {});
      }
    };
  }, [sv]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      sv.widthSV.value = e.nativeEvent.layout.width;
      sv.heightSV.value = e.nativeEvent.layout.height;
    },
    [sv]
  );

  const onTrackLayout = useCallback(
    (e: LayoutChangeEvent) => {
      sv.trackWSV.value = e.nativeEvent.layout.width;
    },
    [sv]
  );

  const buffering = status === 'loading' && !isPlaying;

  return (
    <View style={style} className="bg-black">
      <StyledVideoView
        player={player}
        contentFit="contain"
        nativeControls={false}
        className="h-full w-full"
      />

      {/* Gesture surface */}
      <GestureDetector gesture={composed}>
        <View className="absolute inset-0" collapsable={false} onLayout={onLayout} />
      </GestureDetector>

      <PlayerHud
        hudMode={hudMode}
        hudText={hudText}
        ripple={ripple}
        isPlaying={isPlaying}
        buffering={buffering}
        onPlay={jsTogglePlay}
        hudOpacitySV={hudOpacitySV}
        hudLevelSV={sv.hudLevelSV}
      />

      <PlayerTopBar
        fullscreen={fullscreen}
        title={title}
        controlsVisible={controlsVisible}
        controlsOpacitySV={controlsOpacitySV}
        insets={insets}
        onExit={() => jsToggleFullscreen(false)}
      />

      <PlayerBottomBar
        fullscreen={fullscreen}
        controlsVisible={controlsVisible}
        controlsOpacitySV={controlsOpacitySV}
        isPlaying={isPlaying}
        scrubDisplay={scrubDisplay}
        currentTime={currentTime}
        duration={duration}
        sliderSV={sv.sliderSV}
        sliderGesture={slider}
        insets={insets}
        onTrackLayout={onTrackLayout}
        onTogglePlay={jsTogglePlay}
        onToggleFullscreen={jsToggleFullscreen}
      />
    </View>
  );
}

/**
 * Player gesture definitions. Three Simultaneous branches: two-finger tap,
 * the one-finger chain (double tap → single tap → pan), and long press.
 *
 * The long press must NOT sit inside the one-finger chain — a still finger
 * for 450ms would cancel the pending pan and the drag dies until release
 * (reproduced on device). Math runs in worklets; player/HUD mutations go
 * through runOnJS bridges. Throttles are wall-clock (Date.now()): media-
 * delta gates fire on every touch event during fast drags and flood the JS
 * thread, making the display lag behind the player.
 */
import {
  Gesture,
  type GestureType,
  type LegacyComposedGesture,
} from 'react-native-gesture-handler';
import { type SharedValue, runOnJS, useSharedValue } from 'react-native-reanimated';

/** Whatever GestureDetector accepts (plain or composed gestures). */
/** Whatever the legacy GestureDetector accepts (plain or composed gestures). */
export type AnyGesture = LegacyComposedGesture | GestureType;
import { useMemo } from 'react';
import {
  AXIS_H,
  AXIS_NONE,
  AXIS_V,
  HUD_BRIGHTNESS,
  HUD_NONE,
  HUD_SEEK,
  HUD_VOLUME,
  clamp,
} from './player-shared';

export interface PlayerGestureCallbacks {
  jsToggleControls: () => void;
  jsDoubleTap: (dir: 1 | 0 | -1) => void;
  jsToggleFullscreenGesture: () => void;
  jsSetRate: (rate: number) => void;
  jsHudSpeed: () => void;
  jsScheduleHudHide: () => void;
  jsHudLevel: (mode: number, level: number) => void;
  jsApplyVolume: (v: number) => void;
  jsApplyBrightness: (b: number) => void;
  jsScrubMove: (t: number, dur: number) => void;
  jsScrubEnd: (t: number) => void;
  jsSeekTo: (t: number) => void;
  jsCommitScrub: (frac: number) => void;
}

export interface PlayerGestureValues {
  // geometry
  widthSV: SharedValue<number>;
  heightSV: SharedValue<number>;
  trackWSV: SharedValue<number>;
  // player mirrors
  durationSV: SharedValue<number>;
  currentTimeSV: SharedValue<number>;
  volumeSV: SharedValue<number>;
  brightnessSV: SharedValue<number>;
  // pan scratch
  axisSV: SharedValue<number>;
  startXSV: SharedValue<number>;
  baseTimeSV: SharedValue<number>;
  baseVolumeSV: SharedValue<number>;
  baseBrightnessSV: SharedValue<number>;
  seekTargetSV: SharedValue<number>;
  // HUD / slider
  hudModeSV: SharedValue<number>;
  hudLevelSV: SharedValue<number>;
  sliderSV: SharedValue<number>;
  speedBoostSV: SharedValue<boolean>;
  // wall-clock throttle stamps (ms)
  textMsSV: SharedValue<number>;
  seekMsSV: SharedValue<number>;
  volMsSV: SharedValue<number>;
  briMsSV: SharedValue<number>;
  lastLiveSeekSV: SharedValue<number>;
  lastSliderSeekSV: SharedValue<number>;
}

/**
 * Owns the player's gesture-thread state. The values are created here (not
 * in the component) and returned so the orchestrator can mirror player
 * events into them; `sv` must be a STABLE object — the gesture builders
 * below depend on it, and a fresh bag per render (timeUpdate re-renders ~4/s
 * while playing) would rebuild the handlers mid-gesture.
 */
function usePlayerSharedValues(): PlayerGestureValues {
  const widthSV = useSharedValue(1);
  const heightSV = useSharedValue(1);
  const trackWSV = useSharedValue(1);
  const durationSV = useSharedValue(0);
  const currentTimeSV = useSharedValue(0);
  const volumeSV = useSharedValue(1);
  const brightnessSV = useSharedValue(1);
  const axisSV = useSharedValue(AXIS_NONE);
  const startXSV = useSharedValue(0);
  const baseTimeSV = useSharedValue(0);
  const baseVolumeSV = useSharedValue(1);
  const baseBrightnessSV = useSharedValue(1);
  const seekTargetSV = useSharedValue(0);
  const hudModeSV = useSharedValue(HUD_NONE);
  const hudLevelSV = useSharedValue(0);
  const sliderSV = useSharedValue(0);
  const speedBoostSV = useSharedValue(false);
  const textMsSV = useSharedValue(0);
  const seekMsSV = useSharedValue(0);
  const volMsSV = useSharedValue(0);
  const briMsSV = useSharedValue(0);
  const lastLiveSeekSV = useSharedValue(-1);
  const lastSliderSeekSV = useSharedValue(-1);
  return useMemo(
    () => ({
      widthSV,
      heightSV,
      trackWSV,
      durationSV,
      currentTimeSV,
      volumeSV,
      brightnessSV,
      axisSV,
      startXSV,
      baseTimeSV,
      baseVolumeSV,
      baseBrightnessSV,
      seekTargetSV,
      hudModeSV,
      hudLevelSV,
      sliderSV,
      speedBoostSV,
      textMsSV,
      seekMsSV,
      volMsSV,
      briMsSV,
      lastLiveSeekSV,
      lastSliderSeekSV,
    }),
    [
      widthSV,
      heightSV,
      trackWSV,
      durationSV,
      currentTimeSV,
      volumeSV,
      brightnessSV,
      axisSV,
      startXSV,
      baseTimeSV,
      baseVolumeSV,
      baseBrightnessSV,
      seekTargetSV,
      hudModeSV,
      hudLevelSV,
      sliderSV,
      speedBoostSV,
      textMsSV,
      seekMsSV,
      volMsSV,
      briMsSV,
      lastLiveSeekSV,
      lastSliderSeekSV,
    ]
  );
}

export function usePlayerGestures(cb: PlayerGestureCallbacks): {
  composed: AnyGesture;
  slider: AnyGesture;
  sv: PlayerGestureValues;
} {
  const sv = usePlayerSharedValues();
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(12)
        .onBegin((e) => {
          'worklet';
          sv.axisSV.value = AXIS_NONE;
          sv.startXSV.value = e.x;
          sv.baseTimeSV.value = sv.currentTimeSV.value;
          sv.baseVolumeSV.value = sv.volumeSV.value;
          sv.baseBrightnessSV.value = sv.brightnessSV.value;
          sv.textMsSV.value = 0;
          sv.seekMsSV.value = 0;
          sv.volMsSV.value = 0;
          sv.briMsSV.value = 0;
          sv.lastLiveSeekSV.value = -1;
        })
        .onStart(() => {
          'worklet';
          // A long press may have boosted while the finger was still; a
          // drag hands over to scrubbing, so drop the boost.
          if (sv.speedBoostSV.value) {
            sv.speedBoostSV.value = false;
            runOnJS(cb.jsSetRate)(1);
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (sv.axisSV.value === AXIS_NONE) {
            if (Math.abs(e.translationX) < 10 && Math.abs(e.translationY) < 10) return;
            sv.axisSV.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? AXIS_H : AXIS_V;
          }
          const now = Date.now();
          if (sv.axisSV.value === AXIS_H) {
            const dur = sv.durationSV.value;
            if (dur <= 0) return;
            const target = clamp(
              sv.baseTimeSV.value + (e.translationX / Math.max(sv.widthSV.value, 1)) * dur,
              0,
              dur
            );
            sv.seekTargetSV.value = target;
            sv.hudModeSV.value = HUD_SEEK;
            sv.hudLevelSV.value = dur > 0 ? target / dur : 0;
            // The slider thumb follows the finger instantly (shared value).
            sv.sliderSV.value = dur > 0 ? target / dur : 0;
            if (now - sv.textMsSV.value >= 40) {
              // 25Hz display

              sv.textMsSV.value = now;
              runOnJS(cb.jsScrubMove)(target, dur);
            }
            // Live seek chase; exact target commits on release.
            if (
              sv.lastLiveSeekSV.value < 0 ||
              (now - sv.seekMsSV.value >= 250 && Math.abs(target - sv.lastLiveSeekSV.value) >= 0.5)
            ) {
              sv.lastLiveSeekSV.value = target;
              sv.seekMsSV.value = now;
              runOnJS(cb.jsSeekTo)(target);
            }
          } else {
            // Swipe up raises the value; a full-height drag covers the range.
            const delta = -e.translationY / Math.max(sv.heightSV.value, 1);
            if (sv.startXSV.value >= sv.widthSV.value / 2) {
              const v = clamp(sv.baseVolumeSV.value + delta, 0, 1);
              sv.volumeSV.value = v;
              sv.hudModeSV.value = HUD_VOLUME;
              sv.hudLevelSV.value = v;
              if (now - sv.volMsSV.value >= 80) {
                sv.volMsSV.value = now;
                runOnJS(cb.jsApplyVolume)(v);
                runOnJS(cb.jsHudLevel)(HUD_VOLUME, v);
              }
            } else {
              const b = clamp(sv.baseBrightnessSV.value + delta, 0.02, 1);
              sv.brightnessSV.value = b;
              sv.hudModeSV.value = HUD_BRIGHTNESS;
              sv.hudLevelSV.value = b;
              if (now - sv.briMsSV.value >= 80) {
                sv.briMsSV.value = now;
                runOnJS(cb.jsApplyBrightness)(b);
                runOnJS(cb.jsHudLevel)(HUD_BRIGHTNESS, b);
              }
            }
          }
        })
        .onFinalize(() => {
          'worklet';
          // onFinalize (not onEnd): also runs on mid-gesture cancellation,
          // so a dragged target is never dropped.
          if (sv.axisSV.value === AXIS_H && sv.durationSV.value > 0) {
            runOnJS(cb.jsSeekTo)(sv.seekTargetSV.value);
            runOnJS(cb.jsScrubEnd)(sv.seekTargetSV.value);
          }
          sv.axisSV.value = AXIS_NONE;
          runOnJS(cb.jsScheduleHudHide)();
        }),
    // The bags are stable across renders; biome can't see through them.
    [cb, sv]
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(280)
        .maxDelay(280)
        // Without a movement cap a fast flick "completes" the tap on
        // finger-up (Android's default maxDist is unlimited), which cancels
        // the pan and eats the swipe-seek. 15dp of travel must mean "not a
        // tap".
        // maxDistance keeps a fast flick from completing the tap on
        // finger-up (Android's default maxDist is unlimited) and eating
        // the pan.
        .maxDistance(15)
        .onEnd((e, success) => {
          'worklet';
          if (!success) return;
          const third = sv.widthSV.value / 3;
          if (e.x < third) runOnJS(cb.jsDoubleTap)(-1);
          else if (e.x > third * 2) runOnJS(cb.jsDoubleTap)(1);
          else runOnJS(cb.jsDoubleTap)(0);
        }),
    [cb, sv]
  );

  const singleTapGesture = useMemo(
    () =>
      // No explicit requireFailureOf needed: inside Exclusive every gesture
      // automatically waits for the ones before it to fail, so this tap only
      // fires once the double tap has timed out.
      Gesture.Tap()
        .maxDuration(250)
        .maxDistance(15)
        .onEnd((_e, success) => {
          'worklet';
          if (success) runOnJS(cb.jsToggleControls)();
        }),
    [cb]
  );

  // Bilibili-style: double tap with TWO fingers toggles fullscreen.
  const twoFingerTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .minPointers(2)
        .numberOfTaps(2)
        .maxDuration(300)
        .maxDelay(350)
        .maxDistance(40)
        .onEnd((_e, success) => {
          'worklet';
          if (success) runOnJS(cb.jsToggleFullscreenGesture)();
        }),
    [cb]
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .maxDistance(15)
        .onStart(() => {
          'worklet';
          sv.speedBoostSV.value = true;
          runOnJS(cb.jsSetRate)(2);
          runOnJS(cb.jsHudSpeed)();
        })
        .onFinalize(() => {
          'worklet';
          if (!sv.speedBoostSV.value) return;
          sv.speedBoostSV.value = false;
          runOnJS(cb.jsSetRate)(1);
          runOnJS(cb.jsScheduleHudHide)();
        }),
    [cb, sv]
  );

  const composed = useMemo(
    () =>
      Gesture.Simultaneous(
        twoFingerTapGesture,
        Gesture.Exclusive(doubleTapGesture, singleTapGesture, panGesture),
        longPressGesture
      ),
    [twoFingerTapGesture, doubleTapGesture, singleTapGesture, panGesture, longPressGesture]
  );

  // Slider: touching the track jumps there, dragging scrubs (with the same
  // live follow as the video-area drag), release commits the exact target.
  const slider = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          const frac = clamp(e.x / Math.max(sv.trackWSV.value, 1), 0, 1);
          sv.sliderSV.value = frac;
          sv.lastSliderSeekSV.value = -1;
          const now = Date.now();
          sv.textMsSV.value = now;
          sv.seekMsSV.value = now;
          const dur0 = sv.durationSV.value;
          if (dur0 > 0) runOnJS(cb.jsScrubMove)(frac * dur0, dur0);
        })
        .onUpdate((e) => {
          'worklet';
          const frac = clamp(e.x / Math.max(sv.trackWSV.value, 1), 0, 1);
          sv.sliderSV.value = frac;
          const dur = sv.durationSV.value;
          if (dur <= 0) return;
          const t = frac * dur;
          const now = Date.now();
          if (now - sv.textMsSV.value >= 40) {
            // 25Hz display
            sv.textMsSV.value = now;
            runOnJS(cb.jsScrubMove)(t, dur);
          }
          if (
            sv.lastSliderSeekSV.value < 0 ||
            (now - sv.seekMsSV.value >= 250 && Math.abs(t - sv.lastSliderSeekSV.value) >= 0.5)
          ) {
            sv.lastSliderSeekSV.value = t;
            sv.seekMsSV.value = now;
            runOnJS(cb.jsSeekTo)(t);
          }
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(cb.jsCommitScrub)(sv.sliderSV.value);
        }),
    [cb, sv]
  );

  return { composed, slider, sv };
}

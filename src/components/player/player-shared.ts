/** Shared constants and helpers for the gesture player modules. */

/** Center-HUD content kinds (drives both JS state and worklet SVs). */
export const HUD_NONE = 0;
export const HUD_SEEK = 1;
export const HUD_VOLUME = 2;
export const HUD_BRIGHTNESS = 3;
export const HUD_SPEED = 4;

/** Axis lock for the pan gesture (decided after ~10dp of travel). */
export const AXIS_NONE = 0;
export const AXIS_H = 1;
export const AXIS_V = 2;

// 'worklet' required: Reanimated 4 doesn't auto-workletize called functions.
export function clamp(v: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, v));
}

export const ABS_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** Drop shadow for timecodes over bright frames. */
export const TIME_TEXT_STYLE = {
  textShadowColor: 'rgba(0,0,0,0.9)',
  textShadowRadius: 3,
  textShadowOffset: { width: 0, height: 1 },
} as const;

// Inline style, not bg-* className: NativeWind v5 preview drops bg-*
// classes on views that also carry a style prop.

export const OVERLAY_BG = 'rgba(0,0,0,0.8)';
export const HUD_BG = 'rgba(0,0,0,0.85)';

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

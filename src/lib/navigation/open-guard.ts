/**
 * Single-flight guard for opening the watch screen.
 *
 * `router.push` is a synchronous dispatch — the tap IS the open. The only
 * window where a repeat tap can duplicate the push is while the open is
 * still in flight (the pushed screen has not gained focus yet — e.g. taps
 * queued during a JS-thread stall, or jabs landing during the transition).
 * While that window is open, further opens of the SAME video are swallowed;
 * the pushed screen unlocks the guard when it gains focus. No timers: the
 * lock's lifetime is exactly the open operation.
 */
let openingVideoId: string | null = null;

/** Returns true when this video's open may proceed; false = already opening. */
export function tryBeginVideoOpen(videoId: string): boolean {
  if (openingVideoId === videoId) return false;
  openingVideoId = videoId;
  return true;
}

/** Called by the watch screen when it gains focus — the open has completed. */
export function endVideoOpen(): void {
  openingVideoId = null;
}

/** Test hook — clears any in-flight open. */
export function resetOpenGuard(): void {
  openingVideoId = null;
}

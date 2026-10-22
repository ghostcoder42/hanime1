import { endVideoOpen } from '@/lib/navigation/open-guard';
import { useEvent } from 'expo';
import { useFocusEffect } from 'expo-router';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Watch-screen player lifecycle: keeps autoplay honest across the many ways
 * the native player gets recreated or raced on Android.
 *
 *  - autoplay intent is baked into the player's CONSTRUCTION (useVideoPlayer
 *    setup) because a play() fired right after the source lands races the
 *    native prepare and can be dropped — the video then sits paused forever
 *    (reproduced on Android 8.1)
 *  - a manual pause (while focused) must win over autoplay retries
 *  - a screen stacked under another one must never start playing — its
 *    blur-time pause() ran before the stream source landed and was a no-op,
 *    so a late autoplay would layer audio under the focused screen
 *  - focus loss pauses (the screen stays mounted in the stack)
 */
export function useWatchPlayer(opts: {
  player: VideoPlayer;
  autoplay: boolean;
  /** Changing source (new video via the stack, or a resolution switch). */
  videoSource: string | null | undefined;
  navigation: object;
  /**
   * Focus flag owned by the CALLER: the player's construction callback
   * (useVideoPlayer setup) needs it before this hook runs, to gate the
   * construction-time autoplay intent.
   */
  isFocusedRef: { current: boolean };
}): void {
  const { player, autoplay, videoSource, navigation, isFocusedRef } = opts;

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Manual pause (while this screen is focused) must win over autoplay
  // retries. A pause that arrives with focus already lost is the blur
  // cleanup, not the user. `hasPlayed` keeps the initial paused state from
  // counting as a user pause.
  const userPausedRef = useRef(false);
  const hasPlayedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: isFocusedRef/hasPlayedRef/userPausedRef are lifetime refs; only isPlaying triggers.
  useEffect(() => {
    if (isPlaying) {
      userPausedRef.current = false;
      hasPlayedRef.current = true;
    } else if (hasPlayedRef.current && isFocusedRef.current) {
      userPausedRef.current = true;
    }
  }, [isPlaying]);

  // Start playback automatically when the screen is entered or the source
  // changes unless the user opted out in Settings. Coming back from a deeper
  // screen (author / tag) stays paused — the focus cleanup paused it on
  // leave.
  // biome-ignore lint/correctness/useExhaustiveDependencies: videoSource is an intentional trigger; isFocusedRef is a lifetime ref.
  useEffect(() => {
    if (!autoplay || !isFocusedRef.current) return;
    try {
      player.play();
    } catch {
      // Player not attached to a source yet — replays when videoSource lands.
    }
  }, [autoplay, player, videoSource]);

  // Compensation retry: even with construction-time intent, re-assert autoplay
  // once the native player reports readiness — belt and suspenders for
  // prepare-race paths that drop the initial intent (see hook doc).
  // biome-ignore lint/correctness/useExhaustiveDependencies: userPausedRef/isFocusedRef are lifetime refs; status is the real trigger.
  useEffect(() => {
    if (status !== 'readyToPlay' || !autoplay || userPausedRef.current) return;
    if (!isFocusedRef.current) return;
    try {
      player.play();
    } catch {
      // Player being released — nothing to do.
    }
  }, [status, autoplay, player]);

  // Release the single-flight navigation guard when the OPEN truly completes.
  // Focus fires on the first frame after the push — while the stack
  // transition animation (~300ms) is still running, the source screen stays
  // visible AND touchable, so taps landing inside that window could push the
  // same video again (reproduced: furious tapping stacked 2+ screens). The
  // transition's end is the moment the card is finally covered.
  useEffect(() => {
    // expo-router doesn't type native-stack transition events; emitted at runtime.
    const transitionNav = navigation as unknown as {
      addListener: (event: 'transitionEnd', cb: () => void) => () => void;
    };
    const unsubscribe = transitionNav.addListener('transitionEnd', () => endVideoOpen());
    return unsubscribe;
  }, [navigation]);

  // Pause when this screen loses focus (opening the author page, a tag page
  // or another video keeps this screen mounted in the stack — without this,
  // its audio keeps playing under the new screen). On unmount expo-video may
  // release the native player before this cleanup runs; pause() then throws
  // "shared object already released", which is safe to ignore.
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: isFocusedRef is a lifetime ref.
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
        // Fallback unlock: the user backed out mid-transition (open aborted)
        // or no transition event will fire for this navigator.
        endVideoOpen();
        try {
          player.pause();
        } catch {
          // Player already released (screen unmounting) — nothing to do.
        }
      };
    }, [player])
  );
}

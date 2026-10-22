/** Structural stand-in for the navigation prop (expo-router's types are
 *  runtime-compatible; @react-navigation/native isn't a direct dependency). */
import * as ScreenOrientation from 'expo-screen-orientation';
import { setStatusBarHidden } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * In-app fullscreen: hide header + status bar, lock landscape (unlock
 * returns control to the sensor), hardware back exits fullscreen first.
 */
export interface FullscreenNavLike {
  setOptions: (options: { headerShown?: boolean }) => void;
}

export function useVideoFullscreen(opts: {
  fullscreen: boolean;
  navigation: FullscreenNavLike;
  /** Invoked when the hardware back button should exit fullscreen. */
  onExitFullscreen: () => void;
}): void {
  const { fullscreen, navigation } = opts;

  useEffect(() => {
    navigation.setOptions({ headerShown: !fullscreen });
    setStatusBarHidden(fullscreen, 'slide');
    const lock = fullscreen
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
      : ScreenOrientation.unlockAsync();
    lock.catch(() => {});
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!fullscreen) return false;
      opts.onExitFullscreen();
      return true;
    });
    return () => {
      sub.remove();
      setStatusBarHidden(false, 'slide');
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, [fullscreen, navigation, opts.onExitFullscreen]);
}

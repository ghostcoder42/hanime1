import { useMMKVBoolean } from 'react-native-mmkv';

const AUTOPLAY_KEY = 'settings.autoplay';

/**
 * Toggle for "Autoplay on entering the watch screen" — on by default.
 * `undefined` (never set) reads as enabled; an explicit `false` opts out.
 */
export const usePlaybackSettings = () => {
  const [autoplay, setAutoplay] = useMMKVBoolean(AUTOPLAY_KEY);

  return {
    autoplay: autoplay ?? true,
    setAutoplay,
  };
};

import { useMMKVBoolean } from 'react-native-mmkv';

const HIDE_PREVIEW_KEY = 'settings.hide_preview';

/** Toggle for "Hide Preview" — blanks the app in the recents switcher. */
export const useSecuritySettings = () => {
  const [hidePreview, setHidePreview] = useMMKVBoolean(HIDE_PREVIEW_KEY);

  return {
    hidePreview: hidePreview ?? false,
    setHidePreview,
  };
};

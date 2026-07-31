import { storage } from '@/lib/storage';
import { useMMKVString } from 'react-native-mmkv';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_KEY = 'SELECTED_THEME';

export function useThemeConfig(): [ThemeMode, (mode: ThemeMode) => void] {
  const [value, setValue] = useMMKVString(THEME_KEY);
  const mode = (value === 'light' || value === 'dark' ? value : 'system') as ThemeMode;
  return [mode, setValue];
}

export function getSelectedTheme(): ThemeMode {
  const v = storage.getString(THEME_KEY);
  return v === 'light' || v === 'dark' ? (v as ThemeMode) : 'system';
}

import { storage } from '@/lib/storage';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMMKVString } from 'react-native-mmkv';
import i18n from './index';
import { type Language, languages } from './resources';
import type { TxKeyPath } from './types';

export const LOCAL = 'language';

export function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (languages as readonly string[]).includes(value);
}

/**
 * The default language — what applies when the user hasn't picked one.
 * Reads the i18n instance instead of re-deriving from the device locale, so
 * the selector highlights exactly what is rendered (the locale mapping lives
 * only in ./index's initialLanguage).
 */
export function getDefaultLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'en';
}

/** Read the selected language synchronously (safe at i18n init time). */
export function getLanguage(): Language {
  return isLanguage(storage.getString(LOCAL))
    ? (storage.getString(LOCAL) as Language)
    : getDefaultLanguage();
}

type TranslateOptions = Record<string, string | number>;

/**
 * Reactive, type-safe translate hook. Components MUST use this (not a plain
 * function) so they re-render when the language changes — switching language is
 * then instant (like switching theme), with no app reload. Backed by
 * react-i18next's useTranslation, the de-facto RN/Expo i18n library.
 */
export function useTranslate() {
  const { t } = useTranslation();
  // Cast react-i18next's heavily-overloaded `t` to the simple typed signature
  // the app uses (TxKeyPath key + options → string).
  const tt = t as (key: string, options?: TranslateOptions) => string;
  return useCallback((key: TxKeyPath, options?: TranslateOptions) => tt(key, options ?? {}), [tt]);
}

export function changeLanguage(lang: Language): void {
  storage.set(LOCAL, lang);
  // react-i18next re-renders every component using useTranslate() on change.
  void i18n.changeLanguage(lang);
}

/** Reactive hook for the currently selected language. */
export function useSelectedLanguage(): [Language, (lang: Language) => void] {
  const [value] = useMMKVString(LOCAL);
  const lang = isLanguage(value) ? value : getDefaultLanguage();
  return [lang, changeLanguage];
}

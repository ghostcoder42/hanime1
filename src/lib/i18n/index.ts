import { storage } from '@/lib/storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { type Language, languages, resources } from './resources';

/**
 * NOTE: this file must NOT import from `./utils` — utils imports the i18n
 * instance from here, so a back-import would create a require cycle. During that
 * cycle `utils.LOCAL` is still undefined, so `getString(undefined)` throws and
 * every route that imports `translate` fails to evaluate (expo-router then
 * reports "missing default export" for all routes). Read storage directly here.
 */
function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (languages as readonly string[]).includes(value);
}

function initialLanguage(): Language {
  const stored = storage.getString('language');
  if (isLanguage(stored)) return stored;
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export default i18n;

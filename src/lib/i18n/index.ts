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
 *
 * This initialLanguage() is the single place that maps a device locale to an
 * app language — utils.getDefaultLanguage() just reads the resulting
 * i18n.language, so the rendered language and the highlighted pill cannot
 * disagree.
 */
function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (languages as readonly string[]).includes(value);
}

function initialLanguage(): Language {
  const stored = storage.getString('language');
  if (isLanguage(stored)) return stored;

  const loc = getLocales()[0];
  if (!loc) return 'en';
  // Chinese needs script/region disambiguation — languageCode is 'zh' for
  // EVERY Chinese locale, which used to load Traditional on zh-Hans devices.
  // Hans script or CN/SG/MY region → Simplified, otherwise Traditional.
  const tag = (loc.languageTag ?? '').toLowerCase();
  if (tag.startsWith('zh')) {
    return tag.includes('hans') || tag.includes('cn') || tag.includes('sg') || tag.includes('my')
      ? 'zh-CN'
      : 'zh';
  }
  return isLanguage(loc.languageCode) ? loc.languageCode : 'en';
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

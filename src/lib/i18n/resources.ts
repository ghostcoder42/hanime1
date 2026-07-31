import en from '@/translations/en.json';
import ja from '@/translations/ja.json';
import ko from '@/translations/ko.json';
import zhCN from '@/translations/zh-CN.json';
import zh from '@/translations/zh.json';

export const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
} as const;

export type Language = keyof typeof resources;
export const languages = Object.keys(resources) as Language[];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  zh: '繁體中文',
  ja: '日本語',
  ko: '한국어',
};

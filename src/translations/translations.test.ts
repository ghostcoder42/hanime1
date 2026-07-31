import en from './en.json';
import ja from './ja.json';
import ko from './ko.json';
import zhCN from './zh-CN.json';
import zh from './zh.json';

type Dict = Record<string, unknown>;

/** Flatten a nested object into dot-notation key → value pairs. */
function flatten(obj: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}${key}`;
    if (value !== null && typeof value === 'object') {
      Object.assign(out, flatten(value as Dict, `${path}.`));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const flatEn = flatten(en);
const locales = {
  'zh-CN': flatten(zhCN),
  zh: flatten(zh),
  ja: flatten(ja),
  ko: flatten(ko),
};
const enKeys = Object.keys(flatEn).sort();

describe('translations', () => {
  it('English has no empty values', () => {
    for (const [key, value] of Object.entries(flatEn)) {
      expect(value.length).toBeGreaterThan(0);
      void key;
    }
  });

  // Every locale must expose exactly the same key set as English (catches
  // missing/extra keys whenever a new string is added), with no empty values.
  for (const [locale, flat] of Object.entries(locales)) {
    describe(`${locale}`, () => {
      it('matches the English key set', () => {
        expect(Object.keys(flat).sort()).toEqual(enKeys);
      });

      it('has no empty values', () => {
        for (const [key, value] of Object.entries(flat)) {
          expect(value.length).toBeGreaterThan(0);
          void key;
        }
      });
    });
  }
});

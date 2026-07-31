import type { resources } from './resources';

/** Recursively build dot-notation key paths from the translation resource shape. */
type RecursiveKeyOf<TObj extends Record<string, unknown>, Depth extends number[]> = [
  Depth['length'],
] extends [never]
  ? never
  : TObj extends object
    ? {
        [K in keyof TObj & string]: TObj[K] extends Record<string, unknown>
          ? `${K}.${RecursiveKeyOf<TObj[K], [...Depth, 1]>}`
          : `${K}`;
      }[keyof TObj & string]
    : never;

export type TxKeyPath = RecursiveKeyOf<(typeof resources)['en']['translation'], []>;

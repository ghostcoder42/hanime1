declare module '*.css';

declare module 'lodash.memoize' {
  type AnyFn = (...args: never[]) => unknown;
  function memoize<T extends AnyFn>(
    fn: T,
    resolver?: (...args: Parameters<T>) => unknown
  ): T & { cache: Map<unknown, unknown> };
  export = memoize;
}

import { bestSource, cn, formatCompact, parseChineseCount } from './utils';

describe('parseChineseCount', () => {
  it('parses 萬 (×10k)', () => {
    expect(parseChineseCount('1.1萬次')).toBe(11000);
  });
  it('parses 億 (×100M)', () => {
    expect(parseChineseCount('3.2億次')).toBe(320000000);
  });
  it('parses plain numbers', () => {
    expect(parseChineseCount('7396次')).toBe(7396);
  });
  it('returns null for empty/undefined', () => {
    expect(parseChineseCount(undefined)).toBeNull();
    expect(parseChineseCount('no digits')).toBeNull();
  });
});

describe('formatCompact', () => {
  it('formats thousands', () => {
    expect(formatCompact(12345)).toBe('12.3K');
  });
  it('formats millions', () => {
    expect(formatCompact(2_500_000)).toBe('2.5M');
  });
  it('leaves small numbers as-is', () => {
    expect(formatCompact(999)).toBe('999');
  });
  it('handles null', () => {
    expect(formatCompact(null)).toBe('');
  });
});

describe('bestSource', () => {
  it('returns the highest resolution url', () => {
    const url = bestSource([
      { resolution: 480, url: 'a' },
      { resolution: 1080, url: 'b' },
      { resolution: 720, url: 'c' },
    ]);
    expect(url).toBe('b');
  });
  it('returns undefined when empty', () => {
    expect(bestSource([])).toBeUndefined();
    expect(bestSource(undefined)).toBeUndefined();
  });
});

describe('cn', () => {
  it('joins truthy classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

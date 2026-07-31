import { MIN_TILE_WIDTH, computeColumns } from './use-columns';

describe('computeColumns', () => {
  it('returns at least 1 for narrow widths', () => {
    expect(computeColumns(100)).toBe(1);
  });

  it('scales with width based on min tile width', () => {
    expect(computeColumns(MIN_TILE_WIDTH * 3)).toBe(3);
    expect(computeColumns(MIN_TILE_WIDTH * 3 - 1)).toBe(2);
  });

  it('respects the max cap', () => {
    expect(computeColumns(5000, MIN_TILE_WIDTH, 4)).toBe(4);
  });
});

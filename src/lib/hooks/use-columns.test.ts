import { MIN_TILE_WIDTH, PORTRAIT_MIN_TILE_WIDTH, computeColumns } from './use-columns';

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

  it('supports the denser portrait grid', () => {
    // Phone width (~390) fits 2 landscape cards but 3 portrait posters.
    expect(computeColumns(390)).toBe(2);
    expect(computeColumns(390, PORTRAIT_MIN_TILE_WIDTH)).toBe(3);
  });
});

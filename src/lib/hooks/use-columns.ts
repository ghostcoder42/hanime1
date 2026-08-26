import { useWindowDimensions } from 'react-native';

/** Min tile width for landscape (16:9) cards — the site's feed grid. */
export const MIN_TILE_WIDTH = 165;
/**
 * Min tile width for portrait (2:3) poster cards. Denser than the landscape
 * grid, matching the site's 裏番/泡麵番 cover listings (~3 columns on phones).
 */
export const PORTRAIT_MIN_TILE_WIDTH = 120;
export const MAX_COLUMNS = 6;

/** Compute a responsive column count for a grid. Pure — unit-testable. */
export function computeColumns(
  width: number,
  minTileWidth = MIN_TILE_WIDTH,
  max = MAX_COLUMNS
): number {
  const cols = Math.floor(width / minTileWidth);
  return Math.max(1, Math.min(cols, max));
}

export function useColumns(minTileWidth = MIN_TILE_WIDTH): number {
  const { width } = useWindowDimensions();
  return computeColumns(width, minTileWidth);
}

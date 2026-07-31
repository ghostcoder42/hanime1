import { useWindowDimensions } from 'react-native';

export const MIN_TILE_WIDTH = 165;
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

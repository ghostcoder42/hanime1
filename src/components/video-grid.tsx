import { type TileExtraAction, type TileItem, VideoTile } from '@/components/video-tile';
import { type CardOrientation, cardOrientation } from '@/lib/hanime1/images';
import {
  LANDSCAPE_MAX_COLUMNS,
  MIN_TILE_WIDTH,
  PORTRAIT_MIN_TILE_WIDTH,
  useColumns,
} from '@/lib/hooks';
import { useTranslate } from '@/lib/i18n/utils';
import { FlashList } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

export type VideoGridProps = {
  items: TileItem[];
  onEndReached?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isFetchingNextPage?: boolean;
  isLoading?: boolean;
  columns?: number;
  /**
   * Card form for every tile in the grid. All tiles share one orientation so
   * rows stay aligned (FlashList numColumns needs uniform item heights).
   * `'auto'` (default) infers it from the first item's thumbnail URL — site
   * listings are homogeneous, so this picks the right form per source.
   */
  orientation?: CardOrientation | 'auto';
  ListHeaderComponent?: ReactElement;
  /** Per-tile extra long-press menu actions (e.g. remove from history). */
  extraActions?: (item: TileItem) => TileExtraAction[];
  contentContainerStyle?: { paddingBottom: number };
};

export function VideoGrid({
  items,
  onEndReached,
  onRefresh,
  isRefreshing,
  isFetchingNextPage,
  isLoading,
  columns,
  orientation = 'auto',
  ListHeaderComponent,
  extraActions,
  contentContainerStyle,
}: VideoGridProps) {
  const t = useTranslate();
  const landscapeColumns = useColumns(MIN_TILE_WIDTH, LANDSCAPE_MAX_COLUMNS);
  const portraitColumns = useColumns(PORTRAIT_MIN_TILE_WIDTH);
  const form: CardOrientation =
    orientation !== 'auto'
      ? orientation
      : items[0]
        ? cardOrientation(items[0].thumbnail)
        : 'landscape';
  const numColumns = columns ?? (form === 'portrait' ? portraitColumns : landscapeColumns);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#fb7185" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlashList
        style={{ flex: 1 }}
        data={items}
        numColumns={numColumns}
        renderItem={({ item, index }) => {
          const tile = (
            <View className="px-1 pb-3">
              <VideoTile item={item} orientation={form} extraActions={extraActions?.(item)} />
            </View>
          );
          if (numColumns > 1) {
            // flex-[x] maps to RN `flex: x` (grow/shrink/basis-0), so each cell
            // takes 1/numColumns of the row and the last short row stays
            // aligned instead of stretching. Percentage widths (w-1/n) don't
            // work here — FlashList measures cells before the row width is
            // known, shrinking their content. The literals must stay inline in
            // the className expression — NativeWind only compiles classes it
            // can see statically, so a Record lookup would render unstyled.
            return (
              <View
                className={
                  numColumns === 6
                    ? 'flex-[0.1666667]'
                    : numColumns === 5
                      ? 'flex-[0.2]'
                      : numColumns === 4
                        ? 'flex-[0.25]'
                        : numColumns === 3
                          ? 'flex-[0.3333333]'
                          : 'flex-[0.5]'
                }
              >
                {tile}
              </View>
            );
          }
          void index;
          return tile;
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        key={numColumns}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text className="text-muted-foreground">{t('common.noResults')}</Text>
          </ScrollView>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color="#fb7185" />
            </View>
          ) : items.length > 0 ? (
            <Text className="py-6 text-center text-xs text-muted-foreground">
              {t('common.endOfList')}
            </Text>
          ) : null
        }
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} tintColor="#fb7185" />
          ) : undefined
        }
        contentContainerStyle={{ paddingHorizontal: 4, ...contentContainerStyle }}
      />
    </View>
  );
}

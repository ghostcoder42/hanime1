import { type TileExtraAction, type TileItem, VideoTile } from '@/components/video-tile';
import { useColumns } from '@/lib/hooks';
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
  ListHeaderComponent,
  extraActions,
  contentContainerStyle,
}: VideoGridProps) {
  const t = useTranslate();
  const autoColumns = useColumns();
  const numColumns = columns ?? autoColumns;

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
              <VideoTile item={item} extraActions={extraActions?.(item)} />
            </View>
          );
          if (numColumns > 1) {
            return <View style={{ flex: 1 / numColumns }}>{tile}</View>;
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

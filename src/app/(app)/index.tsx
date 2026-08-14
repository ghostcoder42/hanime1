import { useSearchVideos } from '@/api/video-queries';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import {
  DEFAULT_FILTER,
  type FilterState,
  SearchFilterSheet,
  activeFilterCount,
} from '@/components/search-filter-sheet';
import { VideoGrid } from '@/components/video-grid';
import { GENRES, SORTS } from '@/lib/hanime1/types';
import { useTranslate } from '@/lib/i18n/utils';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

function GenreChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-2.5 py-1.5 ${active ? 'bg-primary' : 'bg-muted'}`}
    >
      <Text className={`text-xs ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export { ScreenErrorBoundary as ErrorBoundary };

export default function BrowseScreen() {
  const t = useTranslate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const sheetRef = useRef<BottomSheetModal>(null);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  // Default browse = genre only (no query, no sort), matching the site. Query is
  // added only when typing; sort/tags/broad only when set in the filter sheet.
  const { data, fetchNextPage, isFetchingNextPage, isLoading, refetch, isFetching } =
    useSearchVideos({
      variables: {
        genre,
        sort: filter.sortKey ? SORTS[filter.sortKey] : undefined,
        query: debounced || undefined,
        tags: filter.tags.length > 0 ? filter.tags : undefined,
        broad: filter.broad || undefined,
      },
    });

  useFocusEffect(useCallback(() => {}, []));

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const activeCount = activeFilterCount(filter);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Row 1: compact search field + advanced-filter trigger (kept on its own
          row so it never wraps with the genre chips below). */}
      <View className="flex-row items-center gap-2 px-3 pt-2">
        <View className="h-[38px] flex-1 flex-row items-center rounded-full bg-muted px-3">
          <Icon name="search" size={15} className="text-muted-foreground" />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder={t('search.placeholder')}
            placeholderTextColor="#a1a1aa"
            returnKeyType="search"
            className="ml-2 flex-1 py-0 text-sm text-foreground"
          />
          {term ? (
            <Pressable hitSlop={8} onPress={() => setTerm('')}>
              <Icon name="close-circle" size={14} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          className="h-[38px] flex-row items-center rounded-full bg-muted px-3"
          onPress={() => sheetRef.current?.present()}
        >
          <Icon name="options" size={16} className="text-foreground" />
          {activeCount > 0 ? (
            <View className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-primary-foreground">
                {activeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Row 2+: genre chips, wrap to as many rows as needed. */}
      <View className="flex-row flex-wrap gap-2 px-3 py-2">
        {GENRES.map((g) => (
          <GenreChip key={g} active={genre === g} label={g} onPress={() => setGenre(g)} />
        ))}
      </View>

      <VideoGrid
        items={items}
        onEndReached={() => fetchNextPage()}
        onRefresh={() => refetch()}
        isRefreshing={isFetching && !isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <SearchFilterSheet
        ref={sheetRef}
        state={filter}
        onChange={setFilter}
        onReset={() => setFilter(DEFAULT_FILTER)}
      />
    </SafeAreaView>
  );
}

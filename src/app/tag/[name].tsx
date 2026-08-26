import { useSearchVideos } from '@/api/video-queries';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { SafeAreaView } from '@/components/safe-area-view';
import { VideoGrid } from '@/components/video-grid';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

export { ScreenErrorBoundary as ErrorBoundary };

export default function TagScreen() {
  const params = useLocalSearchParams<{ name: string; type?: string }>();
  const name = params.name;
  // `query` tags (franchise/character, e.g. #絕區零) must be searched as free
  // text — the `tags[]` filter knows nothing about them.
  const searchTags = params.type === 'query' ? undefined : [name];
  const query = params.type === 'query' ? name : undefined;
  const { data, fetchNextPage, isFetchingNextPage, isLoading, refetch, isFetching } =
    useSearchVideos({ variables: { tags: searchTags, query } });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="px-4 pb-2 pt-2">
        <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
          #{name}
        </Text>
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
    </SafeAreaView>
  );
}

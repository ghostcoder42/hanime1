import { useSearchVideos } from '@/api/video-queries';
import { SafeAreaView } from '@/components/safe-area-view';
import { VideoGrid } from '@/components/video-grid';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

export default function TagScreen() {
  const params = useLocalSearchParams<{ name: string }>();
  const name = params.name;
  const { data, fetchNextPage, isFetchingNextPage, isLoading, refetch, isFetching } =
    useSearchVideos({ variables: { tags: [name] } });

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

import { useUserVideos } from '@/api/video-queries';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { SafeAreaView } from '@/components/safe-area-view';
import { VideoGrid } from '@/components/video-grid';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

export { ScreenErrorBoundary as ErrorBoundary };

export default function UserScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { data, isLoading, refetch, isFetching } = useUserVideos({
    variables: { id: params.id },
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const title = params.name ?? `User ${params.id}`;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="px-4 pb-2 pt-2">
        <Text className="text-xl font-bold text-foreground" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <VideoGrid
        items={items}
        onRefresh={() => refetch()}
        isRefreshing={isFetching && !isLoading}
        isLoading={isLoading}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

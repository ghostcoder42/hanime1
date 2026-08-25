import { useVideoDetail } from '@/api/video-queries';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { Icon } from '@/components/icon';
import { StyledVideoView } from '@/components/native-styled';
import { SafeAreaView } from '@/components/safe-area-view';
import { toOfflineDetail } from '@/lib/download/offline-detail';
import { buildUrl, endpoints } from '@/lib/hanime1/scraper';
import { haptic, hapticSuccess } from '@/lib/haptics';
import { useVideoDownload } from '@/lib/hooks';
import { useTranslate } from '@/lib/i18n/utils';
import {
  useDownloadedStore,
  useFavoritesStore,
  useFollowingStore,
  useHistoryStore,
} from '@/lib/stores';
import { useEvent } from 'expo';
import { Link, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';

export { ScreenErrorBoundary as ErrorBoundary };

export default function WatchScreen() {
  const t = useTranslate();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const {
    data: queryData,
    isLoading,
    isError,
    refetch,
  } = useVideoDetail({
    variables: { id },
  });
  const addToHistory = useHistoryStore((s) => s.addToHistory);

  const [selectedResolution, setSelectedResolution] = useState<number | null>(null);

  // Offline fallback: if the detail query fails but the video is downloaded,
  // render from the local metadata so it can still be played.
  const download = useDownloadedStore((s) => s.downloads.find((d) => d.videoId === id) ?? null);
  const data = queryData ?? (isError && download ? toOfflineDetail(download) : undefined);

  useEffect(() => {
    if (data) {
      addToHistory({
        id: data.id,
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        author: data.author,
      });
    }
  }, [data, addToHistory]);

  const resolution = selectedResolution ?? data?.sources[0]?.resolution ?? null;
  const activeSource = useMemo(
    () => data?.sources.find((s) => s.resolution === resolution) ?? data?.sources[0],
    [data, resolution]
  );

  const downloadState = useVideoDownload({
    videoId: id,
    videoUrl: activeSource?.url,
    title: data?.title ?? '',
    thumbnail: data?.thumbnail ?? '',
    resolution: activeSource?.resolution ?? 0,
    author: data?.author,
  });

  // Prefer the local file when downloaded (works fully offline).
  const videoSource = download?.uri ?? activeSource?.url;

  const player = useVideoPlayer(videoSource ?? null, (p) => {
    p.loop = true;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#fb7185" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">{t('common.error')}</Text>
        <Pressable onPress={() => refetch()} className="mt-3 rounded-full bg-primary px-4 py-2">
          <Text className="text-primary-foreground">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Player */}
        <View className="aspect-video w-full bg-black">
          {videoSource ? (
            <StyledVideoView
              player={player}
              showsTimecodes
              contentFit="contain"
              nativeControls
              className="h-full w-full"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-white/70">No stream source</Text>
            </View>
          )}
          {!isPlaying && videoSource ? (
            <View className="pointer-events-none absolute inset-0 items-center justify-center">
              <Icon name="play-circle" size={64} color="white" />
            </View>
          ) : null}
        </View>

        {/* Meta */}
        <View className="px-4 pt-3">
          <Text className="text-lg font-semibold text-foreground">{data.title}</Text>
          <View className="mt-1 flex-row flex-wrap items-center">
            {data.author ? (
              data.authorId ? (
                <Link
                  href={{
                    pathname: '/user/[id]',
                    params: { id: data.authorId, name: data.author },
                  }}
                  asChild
                >
                  <Pressable>
                    <Text className="text-sm text-rose-400">{data.author}</Text>
                  </Pressable>
                </Link>
              ) : (
                <Text className="text-sm text-rose-400">{data.author}</Text>
              )
            ) : null}
            {data.viewsText ? (
              <Text className="text-sm text-muted-foreground">
                {'  ·  '}
                {data.viewsText}
              </Text>
            ) : null}
            {data.uploadedDate ? (
              <Text className="text-sm text-muted-foreground">
                {'  ·  '}
                {data.uploadedDate}
              </Text>
            ) : null}
          </View>

          {/* Quality + actions */}
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {data.sources.length > 1 &&
              [...data.sources]
                .sort((a, b) => a.resolution - b.resolution)
                .map((s) => (
                  <Pressable
                    key={s.resolution}
                    onPress={() => setSelectedResolution(s.resolution)}
                    className={`rounded-full px-3 py-1.5 ${s.resolution === resolution ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <Text
                      className={
                        s.resolution === resolution ? 'text-primary-foreground' : 'text-foreground'
                      }
                    >
                      {s.resolution}p
                    </Text>
                  </Pressable>
                ))}
          </View>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <FavoriteButton id={data.id} item={data} />
            <DownloadButton state={downloadState} />
            <ShareButton id={data.id} title={data.title} />
            {data.author ? (
              <FollowAuthorButton name={data.author} id={data.authorId ?? data.author} />
            ) : null}
          </View>

          {/* Description */}
          {data.description ? (
            <Text className="mt-4 text-sm leading-5 text-muted-foreground">{data.description}</Text>
          ) : null}

          {/* Tags */}
          {data.tags.length > 0 ? (
            <View className="mt-4">
              <Text className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                {t('detail.tags')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <Link
                    key={`${tag.kind}:${tag.name}`}
                    href={{
                      pathname: '/tag/[name]',
                      params: { name: tag.name, type: tag.kind },
                    }}
                    asChild
                  >
                    <Pressable className="rounded-full bg-muted px-2.5 py-1">
                      <Text className="text-xs text-foreground">
                        {tag.kind === 'query' ? `#${tag.name}` : tag.name}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FavoriteButton({ id, item }: { id: string; item: { title: string; thumbnail: string } }) {
  const t = useTranslate();
  const isFav = useFavoritesStore((s) => s.isFavorite(id));
  const add = useFavoritesStore((s) => s.addFavorite);
  const remove = useFavoritesStore((s) => s.removeFavorite);
  return (
    <Pressable
      onPress={() => {
        hapticSuccess();
        if (isFav) remove(id);
        else add({ id, title: item.title, thumbnail: item.thumbnail });
      }}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${isFav ? 'bg-rose-500' : 'bg-muted'}`}
    >
      <Icon
        name={isFav ? 'heart' : 'heart-outline'}
        size={16}
        color={isFav ? 'white' : '#71717a'}
      />
      <Text className={isFav ? 'text-white' : 'text-foreground'}>
        {t(isFav ? 'actions.removeFromFavorites' : 'actions.addToFavorites')}
      </Text>
    </Pressable>
  );
}

function ShareButton({ id, title }: { id: string; title: string }) {
  const t = useTranslate();
  const onShare = () => {
    haptic();
    void Share.share({ url: buildUrl(endpoints.watch(id)), message: title });
  };
  return (
    <Pressable
      onPress={onShare}
      className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"
    >
      <Icon name="share-outline" size={16} color="#71717a" />
      <Text className="text-foreground">{t('actions.share')}</Text>
    </Pressable>
  );
}

function FollowAuthorButton({ id, name }: { id: string; name: string }) {
  const t = useTranslate();
  const isFollowing = useFollowingStore((s) => s.isFollowing(id));
  const follow = useFollowingStore((s) => s.follow);
  const unfollow = useFollowingStore((s) => s.unfollow);
  return (
    <Pressable
      onPress={() => {
        hapticSuccess();
        if (isFollowing) unfollow(id);
        else follow({ id, name });
      }}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${isFollowing ? 'bg-rose-500' : 'bg-muted'}`}
    >
      <Icon
        name={isFollowing ? 'person-remove' : 'person-add'}
        size={16}
        color={isFollowing ? 'white' : '#71717a'}
      />
      <Text className={isFollowing ? 'text-white' : 'text-foreground'}>
        {t(isFollowing ? 'actions.unfollowAuthor' : 'actions.followAuthor')}
      </Text>
    </Pressable>
  );
}

function DownloadButton({ state }: { state: ReturnType<typeof useVideoDownload> }) {
  const t = useTranslate();
  if (state.error) {
    return (
      <Pressable
        onPress={state.handleDownload}
        className="flex-row items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5"
      >
        <Icon name="alert-circle" size={16} color="white" />
        <Text className="text-white">{t('detail.retry')}</Text>
      </Pressable>
    );
  }
  if (state.isDownloaded) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5">
        <Icon name="checkmark-circle" size={16} color="white" />
        <Text className="text-white">{t('detail.downloaded')}</Text>
      </View>
    );
  }
  if (state.isDownloading) {
    const pct = Math.round(state.downloadProgress * 100);
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
        <ActivityIndicator size="small" color="#fb7185" />
        <Text className="text-foreground">{t('detail.downloading', { progress: pct })}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptic();
        void state.handleDownload();
      }}
      className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5"
    >
      <Icon name="download" size={16} color="white" />
      <Text className="text-primary-foreground">{t('detail.download')}</Text>
    </Pressable>
  );
}

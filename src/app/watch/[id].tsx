import { useVideoDetail } from '@/api/video-queries';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { GesturePlayer } from '@/components/player/gesture-player';
import { SafeAreaView } from '@/components/safe-area-view';
import { VideoMeta } from '@/components/watch/video-meta';
import { toOfflineDetail } from '@/lib/download/offline-detail';
import {
  usePlaybackSettings,
  useVideoDownload,
  useVideoFullscreen,
  useWatchPlayer,
} from '@/lib/hooks';
import { useTranslate } from '@/lib/i18n/utils';
import { AppNetworkError, networkErrorMessage } from '@/lib/network/errors';
import { useDownloadedStore, useHistoryStore } from '@/lib/stores';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';

export { ScreenErrorBoundary as ErrorBoundary };

export default function WatchScreen() {
  const t = useTranslate();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const {
    data: queryData,
    isLoading,
    isError,
    error,
    refetch,
  } = useVideoDetail({
    variables: { id },
  });
  const addToHistory = useHistoryStore((s) => s.addToHistory);

  const [selectedResolution, setSelectedResolution] = useState<number | null>(null);

  // Offline-first: render from local metadata immediately; download.uri
  // stays the player source after fresh data lands, so playback continues.
  const download = useDownloadedStore((s) => s.downloads.find((d) => d.videoId === id) ?? null);
  const offlineDetail = download ? toOfflineDetail(download) : null;
  const data = queryData ?? offlineDetail ?? undefined;

  // 404/410 = removed from the site. With a local download the screen stays
  // playable; notify once. Other failures stay silent while offline data shows.
  const isRemoved = isError && error instanceof AppNetworkError && error.kind === 'notFound';
  const removedNotifiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isRemoved || !offlineDetail || removedNotifiedFor.current === id) return;
    removedNotifiedFor.current = id;
    showMessage({ message: t('detail.videoRemoved'), type: 'warning', position: 'top' });
  }, [isRemoved, offlineDetail, id, t]);

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

  const { autoplay } = usePlaybackSettings();
  const navigation = useNavigation();
  // Focus guard shared with the player's construction callback (see below)
  // and useWatchPlayer.
  const isFocusedRef = useRef(true);

  const player = useVideoPlayer(videoSource ?? null, (p) => {
    p.loop = true;
    // Feed the custom control bar's progress updates (auto-hides when nothing
    // listens).
    p.timeUpdateEventInterval = 0.25;
    // Autoplay must be baked into construction: a play() after the source
    // lands races the native prepare and can be dropped. See use-watch-player.
    if (autoplay && isFocusedRef.current) {
      try {
        p.play();
      } catch {
        // Source not prepared yet — statusChange retry re-asserts autoplay.
      }
    }
  });

  useWatchPlayer({ player, autoplay, videoSource, navigation, isFocusedRef });

  // In-app fullscreen: style change only, playback never restarts.
  const [fullscreen, setFullscreen] = useState(false);
  useVideoFullscreen({
    fullscreen,
    navigation,
    onExitFullscreen: () => setFullscreen(false),
  });

  // Player pinned to the top (YouTube-style), rendered LAST to paint above
  // the scroll content. Fullscreen toggling is a style change only — the
  // player instance (and playback) survives.
  const { width: windowWidth } = useWindowDimensions();
  const inlineHeight = Math.round((windowWidth * 9) / 16);

  // Only gate on loading when there is nothing local to show — a downloaded
  // video must never sit behind a spinner while its metadata refreshes.
  if (isLoading && !offlineDetail) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#fb7185" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-sm leading-5 text-muted-foreground">
          {isRemoved
            ? t('detail.videoRemoved')
            : isError
              ? networkErrorMessage(error, t)
              : t('common.error')}
        </Text>
        <Pressable onPress={() => refetch()} className="mt-3 rounded-full bg-primary px-4 py-2">
          <Text className="text-primary-foreground">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {!fullscreen && <View style={{ height: inlineHeight }} className="w-full bg-black" />}
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <VideoMeta
            detail={data}
            resolution={resolution}
            onSelectResolution={setSelectedResolution}
            downloadState={downloadState}
          />
        </ScrollView>
      </SafeAreaView>

      {/* Player surface — one instance, inline or fullscreen styling */}
      {videoSource ? (
        <GesturePlayer
          player={player}
          fullscreen={fullscreen}
          onToggleFullscreen={setFullscreen}
          title={data.title}
          style={
            fullscreen
              ? [{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, { zIndex: 100 }]
              : {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: inlineHeight,
                  zIndex: 10,
                }
          }
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: inlineHeight,
            zIndex: 10,
          }}
          className="items-center justify-center bg-black"
        >
          <Text className="text-white/70">No stream source</Text>
        </View>
      )}
    </View>
  );
}

import { Icon } from '@/components/icon';
import { StyledImage } from '@/components/native-styled';
import { retryDownload } from '@/lib/download/download-video';
import { type CardOrientation, cardOrientation } from '@/lib/hanime1/images';
import { buildUrl, endpoints } from '@/lib/hanime1/scraper';
import { useVideoActions } from '@/lib/hooks';
import { useActiveDownload } from '@/lib/stores/active-downloads-store';
import { MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';

/** Minimal shape every list/history/favorite item satisfies. */
export type TileItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
  views?: string;
  likeRatio?: string;
  author?: string;
  uploadedRelative?: string;
};

/** A caller-supplied long-press menu action (e.g. "remove from history"). */
export type TileExtraAction = {
  id: string;
  title: string;
  image?: string;
  onPress: () => void;
};

/**
 * No-op long-press handler. Its mere presence makes RN's PressResponder treat
 * a long-press as a long-press (and therefore NOT fire onPress on release),
 * which keeps tap (navigate) and long-press (menu) mutually exclusive. The
 * menu itself is opened natively by MenuView, so this handler does nothing.
 */
const suppressPressOnLongPress = () => {};

/**
 * Short-tap opens the video detail; long-press opens a native context menu
 * (favorite / download / share). The two gestures are mutually exclusive:
 * long-press never triggers navigation.
 *
 * The menu is opened by MenuView's own native gesture (shouldOpenOnLongPress):
 * iOS uses UIContextMenuInteraction (Force Touch / long-press), Android uses
 * the native long-press -> PopupMenu. We do NOT call show() ourselves: doing
 * so on top of the native gesture double-opens the PopupMenu and leaves the
 * touch system in a broken state (taps stop firing app-wide after the menu
 * closes). Mutual exclusivity comes from attaching an onLongPress handler on
 * Android, which makes RN suppress onPress for that gesture.
 */
function VideoTileBase({
  item,
  orientation,
  extraActions,
}: {
  item: TileItem;
  /** Card form; defaults to the orientation inferred from the thumbnail URL. */
  orientation?: CardOrientation;
  extraActions?: TileExtraAction[];
}) {
  const router = useRouter();
  const { isFavorite, isDownloaded, isActive, toggleFavorite, toggleDownload } =
    useVideoActions(item);
  const active = useActiveDownload(item.id);
  const form = orientation ?? cardOrientation(item.thumbnail);

  const openDetail = () => {
    router.push({ pathname: '/watch/[id]', params: { id: item.id } });
  };

  const progressLabel = active
    ? active.progress >= 0
      ? `↓${Math.round(active.progress * 100)}%`
      : '↓'
    : '';

  return (
    <MenuView
      shouldOpenOnLongPress
      actions={[
        {
          id: 'favorite',
          title: isFavorite ? 'Remove from favorites' : 'Add to favorites',
          image: isFavorite ? 'heart.slash' : 'heart',
        },
        {
          id: 'download',
          title:
            active?.status === 'error' || active?.status === 'paused'
              ? 'Resume download'
              : isActive
                ? 'Downloading…'
                : isDownloaded
                  ? 'Downloaded'
                  : 'Download',
          image: 'arrow.down.circle',
          attributes:
            isActive && active?.status !== 'error' && active?.status !== 'paused'
              ? { disabled: true }
              : undefined,
        },
        {
          id: 'share',
          title: 'Share',
          image: 'square.and.arrow',
        },
        ...(extraActions ?? []).map((a) => ({ id: a.id, title: a.title, image: a.image })),
      ]}
      onPressAction={({ nativeEvent }) => {
        const ev = nativeEvent.event;
        if (ev === 'favorite') {
          toggleFavorite();
        } else if (ev === 'download') {
          if (active?.status === 'error' || active?.status === 'paused') {
            void retryDownload(item.id);
          } else {
            void toggleDownload();
          }
        } else if (ev === 'share') {
          void Share.share({
            url: buildUrl(endpoints.watch(item.id)),
            message: item.title,
          });
        } else {
          extraActions?.find((a) => a.id === ev)?.onPress();
        }
      }}
    >
      <Pressable
        onPress={openDetail}
        onLongPress={Platform.OS === 'android' ? suppressPressOnLongPress : undefined}
        testID="video-tile"
        className="active:opacity-80"
      >
        <View
          className={`relative w-full overflow-hidden rounded-lg bg-muted ${
            form === 'portrait' ? 'aspect-[2/3]' : 'aspect-[16/9]'
          }`}
        >
          <StyledImage
            source={item.thumbnail}
            className="h-full w-full"
            contentFit="cover"
            transition={150}
            recyclingKey={item.id}
          />
          {item.duration ? (
            <View className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5">
              <Text className="text-[10px] font-medium text-white">{item.duration}</Text>
            </View>
          ) : null}
          {(isFavorite || isDownloaded || isActive) && (
            <View className="absolute left-1 top-1 flex-row gap-1">
              {isFavorite && (
                <View testID="video-tile-fav" className="rounded bg-black/60 p-0.5">
                  <Icon name="heart" size={12} color="#fb7185" />
                </View>
              )}
              {isActive && (
                <View testID="video-tile-downloading" className="rounded bg-sky-500 p-0.5">
                  <Text className="text-[10px] font-medium text-white">{progressLabel}</Text>
                </View>
              )}
              {isDownloaded && (
                <View testID="video-tile-downloaded" className="rounded bg-black/60 p-0.5">
                  <Icon name="download" size={12} color="#4ade80" />
                </View>
              )}
            </View>
          )}
        </View>
        <Text className="mt-1.5 text-sm font-medium text-foreground" numberOfLines={2}>
          {item.title}
        </Text>
        {item.author ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {item.author}
          </Text>
        ) : null}
        {(item.views || item.likeRatio || item.uploadedRelative) && (
          <Text className="text-xs text-muted-foreground/80" numberOfLines={1}>
            {[item.uploadedRelative, item.views, item.likeRatio ? `${item.likeRatio}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </Pressable>
    </MenuView>
  );
}

export const VideoTile = memo(VideoTileBase);

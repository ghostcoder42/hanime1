/**
 * Row of action buttons under the watch-screen metadata: favorite, download,
 * share, follow-author. Extracted from the watch screen to keep it small.
 */
import { Icon } from '@/components/icon';
import { buildUrl, endpoints } from '@/lib/hanime1/scraper';
import { haptic, hapticSuccess } from '@/lib/haptics';
import type { useVideoDownload } from '@/lib/hooks';
import { useTranslate } from '@/lib/i18n/utils';
import { useFavoritesStore, useFollowingStore } from '@/lib/stores';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';

export function FavoriteButton({
  id,
  item,
}: { id: string; item: { title: string; thumbnail: string } }) {
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

export function ShareButton({ id, title }: { id: string; title: string }) {
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

export function FollowAuthorButton({ id, name }: { id: string; name: string }) {
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

export function DownloadButton({ state }: { state: ReturnType<typeof useVideoDownload> }) {
  const t = useTranslate();
  if (state.error) {
    return (
      <Pressable
        onPress={state.handleDownload}
        className="flex-row items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5"
      >
        <Icon name="alert-circle" size={16} color="white" />
        <Text className="text-white">{t('common.resume')}</Text>
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

/**
 * The watch screen's metadata section below the player: title, author/views/
 * date line, resolution chips, action buttons, description and tags.
 */
import {
  DownloadButton,
  FavoriteButton,
  FollowAuthorButton,
  ShareButton,
} from '@/components/watch/action-buttons';
import type { VideoDetail } from '@/lib/hanime1/types';
import type { useVideoDownload } from '@/lib/hooks';
import { useTranslate } from '@/lib/i18n/utils';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export function VideoMeta({
  detail,
  resolution,
  onSelectResolution,
  downloadState,
}: {
  detail: VideoDetail;
  resolution: number | null;
  onSelectResolution: (resolution: number) => void;
  downloadState: ReturnType<typeof useVideoDownload>;
}) {
  const t = useTranslate();
  const data = detail;

  return (
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

      {/* Quality chips */}
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {data.sources.length > 1 &&
          [...data.sources]
            .sort((a, b) => a.resolution - b.resolution)
            .map((s) => (
              <Pressable
                key={s.resolution}
                onPress={() => onSelectResolution(s.resolution)}
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

      {data.description ? (
        <Text className="mt-4 text-sm leading-5 text-muted-foreground">{data.description}</Text>
      ) : null}

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
  );
}

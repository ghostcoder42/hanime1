import { Icon } from '@/components/icon';
import { StyledImage } from '@/components/native-styled';
import { SafeAreaView } from '@/components/safe-area-view';
import { VideoGrid } from '@/components/video-grid';
import type { DownloadMetadata } from '@/lib/download';
import { cancelDownload } from '@/lib/download/download-video';
import type { TxKeyPath } from '@/lib/i18n/types';
import { useTranslate } from '@/lib/i18n/utils';
import { useDownloadedStore, useFavoritesStore, useHistoryStore } from '@/lib/stores';
import { type ActiveDownload, useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

type Tab = 'history' | 'downloads' | 'favorites';

// Keys only — labels are translated inside LibraryScreen (a hook can't run at
// module scope).
const TAB_KEYS: Tab[] = ['downloads', 'favorites', 'history'];
const TAB_LABEL: Record<Tab, TxKeyPath> = {
  downloads: 'library.downloads',
  favorites: 'library.favorites',
  history: 'library.history',
};

function EmptyState({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-muted-foreground">{label}</Text>
    </View>
  );
}

function HistoryTab() {
  const t = useTranslate();
  const history = useHistoryStore((s) => s.history);
  const removeFromHistory = useHistoryStore((s) => s.removeFromHistory);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  if (history.length === 0) {
    return <EmptyState label={t('library.noHistory')} />;
  }

  const onClear = () =>
    Alert.alert(t('settings.clearHistory'), t('library.clearHistoryConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clear'), style: 'destructive', onPress: clearHistory },
    ]);

  return (
    <View className="flex-1">
      <View className="flex-row justify-end px-4 py-2">
        <Pressable hitSlop={8} onPress={onClear}>
          <Text className="text-sm text-rose-500">{t('library.clearHistory')}</Text>
        </Pressable>
      </View>
      <VideoGrid
        items={history}
        contentContainerStyle={{ paddingBottom: 24 }}
        extraActions={(item) => [
          {
            id: 'remove-history',
            title: t('library.removeHistory'),
            image: 'trash',
            onPress: () => removeFromHistory(item.id),
          },
        ]}
      />
    </View>
  );
}

function FavoritesTab() {
  const t = useTranslate();
  const favorites = useFavoritesStore((s) => s.favorites);

  if (favorites.length === 0) {
    return <EmptyState label={t('library.noFavorites')} />;
  }

  return <VideoGrid items={favorites} contentContainerStyle={{ paddingBottom: 24 }} />;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(ts: number): string {
  return ts ? new Date(ts).toLocaleDateString() : '';
}

function ActiveDownloadRow({ task }: { task: ActiveDownload }) {
  const t = useTranslate();
  const [cancelling, setCancelling] = useState(false);
  const indeterminate = task.progress < 0;
  const pct = indeterminate ? 0 : Math.round(task.progress * 100);
  const barWidth = indeterminate ? 40 : pct;

  const onCancel = async () => {
    setCancelling(true);
    await cancelDownload(task.videoId);
  };

  const statusText =
    task.status === 'error'
      ? `${t('library.failed')}${task.error ? `: ${task.error}` : ''}`
      : task.status === 'cancelled'
        ? t('library.cancelled')
        : indeterminate
          ? `${t('library.downloading')}…`
          : `${t('library.downloading')} · ${pct}%`;

  return (
    <View className="flex-row items-center px-4 py-2" testID="active-download-row">
      <StyledImage
        source={task.thumbnail}
        className="mr-3 h-16 w-28 rounded bg-muted"
        contentFit="cover"
      />
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {task.title}
        </Text>
        <Text className="text-xs text-muted-foreground">{statusText}</Text>
        <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <View
            className={task.status === 'error' ? 'h-full bg-destructive' : 'h-full bg-sky-500'}
            style={{ width: `${barWidth}%` }}
          />
        </View>
      </View>
      <Pressable
        onPress={onCancel}
        disabled={cancelling || task.status === 'cancelled'}
        className="ml-2 items-center justify-center rounded-full bg-muted px-3 py-1.5"
        testID="active-download-cancel"
      >
        <Text className="text-xs font-medium text-foreground">
          {cancelling ? '…' : t('common.cancel')}
        </Text>
      </Pressable>
    </View>
  );
}

function DownloadRow({
  item,
  onRemove,
}: {
  item: DownloadMetadata;
  onRemove: (videoId: string) => void;
}) {
  const t = useTranslate();
  const router = useRouter();

  const confirmRemove = () => {
    Alert.alert(
      t('library.deleteDownloadTitle'),
      t('library.deleteDownloadMsg', { title: item.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => onRemove(item.videoId),
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/watch/[id]', params: { id: item.videoId } })}
      className="flex-row items-center px-4 py-2"
    >
      <StyledImage
        source={item.thumbnail}
        className="mr-3 h-16 w-28 rounded bg-muted"
        contentFit="cover"
      />
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {item.title}
        </Text>
        {item.author ? <Text className="text-xs text-muted-foreground">{item.author}</Text> : null}
        <Text className="text-xs text-muted-foreground">
          {item.resolution}p{item.size ? ` · ${formatBytes(item.size)}` : ''} ·{' '}
          {formatDate(item.downloadedAt)}
        </Text>
      </View>
      <Pressable
        onPress={confirmRemove}
        hitSlop={8}
        className="ml-2 items-center justify-center rounded-full bg-muted p-2"
        testID="download-delete"
      >
        <Icon name="trash" size={16} color="#ef4444" />
      </Pressable>
    </Pressable>
  );
}

function DownloadsTab() {
  const t = useTranslate();
  const downloads = useDownloadedStore((s) => s.downloads);
  const loaded = useDownloadedStore((s) => s.loaded);
  const hydrate = useDownloadedStore((s) => s.hydrate);
  const remove = useDownloadedStore((s) => s.remove);
  const activeTasks = useActiveDownloadsStore((s) => s.tasks);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const active = useMemo(
    () => Object.values(activeTasks).sort((a, b) => b.startedAt - a.startedAt),
    [activeTasks]
  );
  const activeIds = useMemo(() => new Set(active.map((t) => t.videoId)), [active]);

  const done = useMemo(
    () => downloads.filter((d) => !activeIds.has(d.videoId)),
    [downloads, activeIds]
  );

  const isEmpty = loaded && active.length === 0 && done.length === 0;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={isEmpty ? { flex: 1 } : { paddingBottom: 24 }}
    >
      {isEmpty ? (
        <EmptyState label={t('library.noDownloads')} />
      ) : (
        <>
          {active.map((task) => (
            <ActiveDownloadRow key={`active-${task.videoId}`} task={task} />
          ))}
          {done.map((entry) => (
            <DownloadRow key={entry.videoId} item={entry} onRemove={remove} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

export default function LibraryScreen() {
  const t = useTranslate();
  const [activeTab, setActiveTab] = useState<Tab>('downloads');
  const pagerRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const TABS = useMemo(() => TAB_KEYS.map((key) => ({ key, label: t(TAB_LABEL[key]) })), [t]);

  const goToPage = useCallback(
    (index: number) => {
      setActiveTab(TABS[index].key);
      pagerRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [width, TABS]
  );

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      if (page >= 0 && page < TABS.length && TABS[page].key !== activeTab) {
        setActiveTab(TABS[page].key);
      }
    },
    [width, activeTab, TABS]
  );

  const renderTab = (tab: Tab) => {
    switch (tab) {
      case 'history':
        return <HistoryTab />;
      case 'downloads':
        return <DownloadsTab />;
      case 'favorites':
        return <FavoritesTab />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Text className="px-4 pb-2 pt-2 text-2xl font-bold text-foreground">
        {t('library.title')}
      </Text>
      <View className="flex-row border-b border-muted pb-0.5">
        {TABS.map((tab, index) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => goToPage(index)}
              className={`flex-1 items-center py-3 ${isActive ? 'border-b-2 border-primary' : ''}`}
            >
              <Text
                className={
                  isActive ? 'text-sm font-medium text-primary' : 'text-sm text-muted-foreground'
                }
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={pagerRef}
        className="flex-1"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {TABS.map((tab) => (
          <View key={tab.key} className="flex-1" style={{ width }}>
            {renderTab(tab.key)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

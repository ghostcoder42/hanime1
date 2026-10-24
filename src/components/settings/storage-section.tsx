/**
 * Settings section: download storage location (app space vs user space /
 * system media library). The toggle only decides where NEW downloads land;
 * switching triggers the corresponding migration flow:
 *
 * - app → user: ask for the media-library permission, then move every
 *   app-space video into the media library automatically.
 * - user → app: prompt — move the old videos back, or keep them in the
 *   media library (mixed state; per-video location lives in metadata).
 */
import { useTranslate } from '@/lib/i18n/utils';
import {
  getAllDownloads,
  getStorageLocation,
  hasVideosIn,
  migrateAllToAppSpace,
  migrateAllToUserSpace,
  setStorageLocation,
  type StorageLocation,
} from '@/lib/download/storage-migrate';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { ensureUserSpacePermission } from '@/lib/download/user-space';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

const LOCATIONS: StorageLocation[] = ['app', 'user'];

export function StorageSection() {
  const t = useTranslate();
  const [loc, setLoc] = useState<StorageLocation>(() => getStorageLocation());
  const [migrating, setMigrating] = useState(false);

  const labelFor = (l: StorageLocation) =>
    l === 'app' ? t('settings.locApp') : t('settings.locUser');

  const runMigration = async (direction: 'toUser' | 'toApp') => {
    setMigrating(true);
    try {
      const migrate = direction === 'toUser' ? migrateAllToUserSpace : migrateAllToAppSpace;
      let shown = -1;
      const result = await migrate((p) => {
        if (p.done === shown) return;
        shown = p.done;
        showMessage({
          message: t('settings.migrating', { done: p.done, total: p.total }),
          type: 'info',
          duration: 2500,
        });
      });
      // Files moved behind the metadata store's back — re-read it all.
      await useDownloadedStore.getState().hydrate();
      if (result.failed.length > 0) {
        showMessage({
          message: t('settings.migratePartial', {
            moved: result.moved,
            failed: result.failed.length,
          }),
          type: 'warning',
          duration: 3500,
        });
      } else if (result.moved > 0) {
        showMessage({
          message: t(
            direction === 'toUser' ? 'settings.migrateDoneUser' : 'settings.migrateDoneApp',
            {
              n: result.moved,
            }
          ),
          type: 'success',
          duration: 2500,
        });
      }
    } finally {
      setMigrating(false);
    }
  };

  const chooseLocation = (next: StorageLocation) => {
    if (migrating || next === loc) return;

    if (next === 'user') {
      void (async () => {
        const granted = await ensureUserSpacePermission();
        if (!granted) {
          showMessage({ message: t('settings.storagePermDenied'), type: 'danger', duration: 3000 });
          return;
        }
        setStorageLocation('user');
        setLoc('user');
        if (hasVideosIn('app')) await runMigration('toUser');
      })();
      return;
    }

    // user → app: old videos need a user decision.
    if (hasVideosIn('user')) {
      const n = getAllDownloads().filter(
        (m: { location?: string }) => m.location === 'user'
      ).length;
      Alert.alert(t('settings.moveToAppTitle'), t('settings.moveToAppMsg', { n }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.moveToAppKeep'),
          onPress: () => {
            setStorageLocation('app');
            setLoc('app');
          },
        },
        {
          text: t('settings.moveToAppMove'),
          onPress: () => {
            setStorageLocation('app');
            setLoc('app');
            void runMigration('toApp');
          },
        },
      ]);
      return;
    }

    setStorageLocation('app');
    setLoc('app');
  };

  return (
    <View>
      <Text className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('settings.storage')}
      </Text>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="max-w-[55%]">
          <Text className="text-foreground">{t('settings.storageLocation')}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">{t('settings.storageDesc')}</Text>
        </View>
        <View className="flex-row items-center">
          {LOCATIONS.map((l) => (
            <Pressable
              key={l}
              onPress={() => chooseLocation(l)}
              className={`mr-2 rounded-full px-3 py-1.5 ${loc === l ? 'bg-primary' : 'bg-muted'}`}
            >
              <Text className={loc === l ? 'text-primary-foreground' : 'text-foreground'}>
                {labelFor(l)}
              </Text>
            </Pressable>
          ))}
          {migrating ? <ActivityIndicator size="small" color="#f43f5e" /> : null}
        </View>
      </View>
    </View>
  );
}

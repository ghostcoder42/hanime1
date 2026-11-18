/**
 * Settings section: download storage location (app space vs user space) and,
 * on Android, user-space visibility — the system media library (indexed,
 * shows in gallery apps) or a hidden SAF folder (`.nomedia`, invisible to
 * media scanners). Switching either triggers the matching migration flow
 * behind a confirm dialog: moving copies every file, so duration and disk
 * space are called out up front.
 */
import { useTranslate } from '@/lib/i18n/utils';
import type { TxKeyPath } from '@/lib/i18n/types';
import {
  NO_SPACE,
  type StorageLocation,
  type UserSpaceMode,
  getAllDownloads,
  getStorageLocation,
  getUserSpaceMode,
  hasFreeSpaceForMigration,
  migrateAllToAppSpace,
  type MigrationProgress,
  type MigrationResult,
  migrateAllToUserSpace,
  migrateHiddenFolder,
  migrateHiddenToMedia,
  migrateMediaToHidden,
  setStorageLocation,
  setUserSpaceMode,
} from '@/lib/download/storage-migrate';
import { ensureUserSpacePermission } from '@/lib/download/user-space';
import {
  getHiddenFolderDisplayPath,
  getHiddenFolderUri,
  pickHiddenFolder,
} from '@/lib/download/user-space-hidden';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useMigrationStore } from '@/lib/stores/migration-store';
import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type MigrationKind = 'toUser' | 'toApp' | 'toHidden' | 'toMedia' | 'toFolder';

export function StorageSection() {
  const t = useTranslate();
  const [loc, setLoc] = useState<StorageLocation>(() => getStorageLocation());
  const [mode, setMode] = useState<UserSpaceMode>(() => getUserSpaceMode());
  const [folderPath, setFolderPath] = useState<string | null>(() => getHiddenFolderDisplayPath());
  const [migrating, setMigrating] = useState(false);

  const appVideos = () => getAllDownloads().filter((m) => (m.location ?? 'app') === 'app');
  const mediaVideos = () => getAllDownloads().filter((m) => m.location === 'user' && m.assetId);
  const hiddenVideos = () => getAllDownloads().filter((m) => m.location === 'user' && m.docUri);

  /** Migration copies before deleting — abort with a clear reason on a full disk. */
  const preflightSpace = async (): Promise<boolean> => {
    if (await hasFreeSpaceForMigration()) return true;
    showMessage({ message: t('settings.noSpace'), type: 'danger', duration: 3500 });
    return false;
  };

  const runMigration = async (
    kind: MigrationKind,
    migrateOverride?: (onProgress?: (p: MigrationProgress) => void) => Promise<MigrationResult>
  ) => {
    setMigrating(true);
    showMessage({ message: t('settings.migrateDeleteHint'), type: 'info', duration: 3500 });
    const progress = useMigrationStore.getState();
    progress.begin(0);
    try {
      const migrate =
        migrateOverride ??
        (kind === 'toUser'
          ? migrateAllToUserSpace
          : kind === 'toApp'
            ? migrateAllToAppSpace
            : kind === 'toHidden'
              ? migrateMediaToHidden
              : migrateHiddenToMedia);
      const result = await migrate((p) => {
        useMigrationStore.getState().update(p.done, p.total, p.currentTitle);
      });
      // Files moved behind the metadata store's back — re-read it all.
      await useDownloadedStore.getState().hydrate();
      const hitNoSpace = result.failed.some((f: { reason: string }) => f.reason === NO_SPACE);
      if (result.failed.length > 0) {
        showMessage({
          message: `${t('settings.migratePartial', {
            moved: result.moved,
            failed: result.failed.length,
          })}${hitNoSpace ? `\n${t('settings.noSpace')}` : ''}`,
          type: 'warning',
          duration: 4000,
        });
      } else if (result.moved > 0) {
        const doneKey: Record<MigrationKind, TxKeyPath> = {
          toUser: 'settings.migrateDoneUser',
          toApp: 'settings.migrateDoneApp',
          toHidden: 'settings.migrateDoneHidden',
          toMedia: 'settings.migrateDoneMedia',
          toFolder: 'settings.migrateDoneFolder',
        };
        showMessage({
          message: t(doneKey[kind], { n: result.moved }),
          type: 'success',
          duration: 2500,
        });
      }
    } finally {
      useMigrationStore.getState().end();
      setMigrating(false);
    }
  };

  const bytesOf = (metas: { size?: number }[]) => metas.reduce((n, m) => n + (m.size || 0), 0);

  const chooseLocation = (next: StorageLocation) => {
    if (migrating || next === loc) return;

    if (next === 'user') {
      void (async () => {
        const granted = await ensureUserSpacePermission();
        if (!granted) {
          showMessage({ message: t('settings.storagePermDenied'), type: 'danger', duration: 3000 });
          return;
        }
        const videos = appVideos();
        if (videos.length === 0) {
          setStorageLocation('user');
          setLoc('user');
          return;
        }
        if (!(await preflightSpace())) return;
        const size = formatBytes(bytesOf(videos));
        Alert.alert(
          t('settings.migrateConfirmTitle'),
          t('settings.migrateConfirmMsg', { n: videos.length, size }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.migrateConfirmStart'),
              onPress: () => {
                setStorageLocation('user');
                setLoc('user');
                void runMigration('toUser');
              },
            },
          ]
        );
      })();
      return;
    }

    // user → app: old videos need a user decision.
    const videos = getAllDownloads().filter((m) => m.location === 'user');
    if (videos.length > 0) {
      const size = formatBytes(bytesOf(videos));
      Alert.alert(
        t('settings.moveToAppTitle'),
        `${t('settings.moveToAppMsg', { n: videos.length })}\n\n${t('settings.migrateSlowNote', { size })}`,
        [
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
              void (async () => {
                if (!(await preflightSpace())) return; // stay on user, retry later
                setStorageLocation('app');
                setLoc('app');
                await runMigration('toApp');
              })();
            },
          },
        ]
      );
      return;
    }

    setStorageLocation('app');
    setLoc('app');
  };

  const chooseVisibility = (next: UserSpaceMode) => {
    if (migrating || next === mode) return;

    if (next === 'hidden') {
      void (async () => {
        try {
          // The picked folder is remembered; only a first-time (or lost)
          // grant goes through the system picker again.
          let treeUri = getHiddenFolderUri();
          if (!treeUri) {
            const picked = await pickHiddenFolder();
            if (!picked.uri) return; // cancelled
            treeUri = picked.uri;
            if (picked.markerFailed) {
              showMessage({
                message: t('settings.nomediaFailed'),
                type: 'warning',
                duration: 4000,
              });
            }
          }
          setFolderPath(getHiddenFolderDisplayPath());
        } catch (error) {
          showMessage({
            message: t('settings.folderSetupFailed', {
              reason: error instanceof Error ? error.message : String(error),
            }),
            type: 'danger',
            duration: 4000,
          });
          return;
        }
        setUserSpaceMode('hidden');
        setMode('hidden');
        const videos = mediaVideos();
        if (videos.length === 0) return;
        if (!(await preflightSpace())) return;
        const size = formatBytes(bytesOf(videos));
        Alert.alert(
          t('settings.moveToHiddenTitle'),
          `${t('settings.moveToHiddenMsg', { n: videos.length, size })}`,
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.migrateConfirmStart'),
              onPress: () => void runMigration('toHidden'),
            },
          ]
        );
      })();
      return;
    }

    const videos = hiddenVideos();
    if (videos.length === 0) {
      setUserSpaceMode('media');
      setMode('media');
      return;
    }
    const size = formatBytes(bytesOf(videos));
    Alert.alert(
      t('settings.moveToMediaTitle'),
      t('settings.moveToMediaMsg', { n: videos.length, size }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.migrateConfirmStart'),
          onPress: () => {
            setUserSpaceMode('media');
            setMode('media');
            void runMigration('toMedia');
          },
        },
      ]
    );
  };

  const changeFolder = () => {
    if (migrating) return;
    void (async () => {
      try {
        const oldTree = getHiddenFolderUri();
        const { uri, markerFailed } = await pickHiddenFolder();
        if (!uri) return; // cancelled
        setFolderPath(getHiddenFolderDisplayPath());
        if (markerFailed) {
          showMessage({ message: t('settings.nomediaFailed'), type: 'warning', duration: 4000 });
        }
        // Videos left behind in the previous folder still play and delete
        // fine (per-file document uris), but the user expects one home.
        if (oldTree && uri !== oldTree) {
          const videos = getAllDownloads().filter(
            (m) => m.docUri && !m.docUri.startsWith(`${uri}/`)
          );
          if (videos.length === 0) return;
          if (!(await preflightSpace())) return;
          const size = formatBytes(bytesOf(videos));
          Alert.alert(
            t('settings.moveFolderTitle'),
            t('settings.moveFolderMsg', { n: videos.length, size }),
            [
              { text: t('settings.keepInOld'), style: 'cancel' },
              {
                text: t('settings.migrateConfirmStart'),
                onPress: () => void runMigration('toFolder', (p) => migrateHiddenFolder(uri, p)),
              },
            ]
          );
        }
      } catch (error) {
        showMessage({
          message: t('settings.folderSetupFailed', {
            reason: error instanceof Error ? error.message : String(error),
          }),
          type: 'danger',
          duration: 4000,
        });
      }
    })();
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
          {(['app', 'user'] as StorageLocation[]).map((l) => (
            <Pressable
              key={l}
              disabled={migrating}
              onPress={() => chooseLocation(l)}
              className={`mr-2 rounded-full px-3 py-1.5 ${loc === l ? 'bg-primary' : 'bg-muted'}`}
            >
              <Text className={loc === l ? 'text-primary-foreground' : 'text-foreground'}>
                {l === 'app' ? t('settings.locApp') : t('settings.locUser')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {Platform.OS === 'android' ? (
        // Sub-setting of the storage location: always configurable (so the
        // mode can be pre-set before the first user-space download ever gets
        // indexed), indented and dimmed while it has no effect.
        <View className={`ml-4 border-l border-border ${loc === 'user' ? '' : 'opacity-50'}`}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="max-w-[55%]">
              <Text className={loc === 'user' ? 'text-foreground' : 'text-muted-foreground'}>
                {t('settings.visTitle')}
              </Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">{t('settings.visDesc')}</Text>
            </View>
            <View className="flex-row items-center">
              {(['media', 'hidden'] as UserSpaceMode[]).map((m) => (
                <Pressable
                  key={m}
                  disabled={migrating}
                  onPress={() => chooseVisibility(m)}
                  className={`mr-2 rounded-full px-3 py-1.5 ${mode === m ? 'bg-primary' : 'bg-muted'}`}
                >
                  <Text className={mode === m ? 'text-primary-foreground' : 'text-foreground'}>
                    {m === 'media' ? t('settings.visMedia') : t('settings.visHidden')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {mode === 'hidden' ? (
            <View className="flex-row items-center justify-between px-4 py-2">
              <View className="max-w-[70%]">
                <Text className="text-xs text-muted-foreground">
                  {t('settings.visFolderAt', {
                    path: folderPath ?? t('settings.visFolderNone'),
                  })}
                </Text>
              </View>
              <Pressable
                disabled={migrating}
                onPress={changeFolder}
                className="rounded-full bg-muted px-3 py-1"
              >
                <Text className="text-xs text-foreground">{t('settings.visFolderChange')}</Text>
              </Pressable>
            </View>
          ) : null}

          {loc === 'app' ? (
            <Text className="px-4 pb-3 text-xs text-muted-foreground">
              {t('settings.visInactiveHint')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

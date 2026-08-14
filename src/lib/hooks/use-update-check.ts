import { useLatestRelease } from '@/api/update-queries';
import { useTranslate } from '@/lib/i18n/utils';
import { useUpdateStore } from '@/lib/stores/update-store';
import { compareVersions } from '@/lib/updates';
import { Env } from '@env';
import { useCallback, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

export type UpdateCheckState = {
  checking: boolean;
  /** Latest version seen from GitHub (persisted), undefined when never checked. */
  latestVersion: string | undefined;
  /** Epoch ms of the last completed check (persisted). */
  lastCheckedAt: number | undefined;
  /** True when the persisted latest version is newer than the running app. */
  hasUpdate: boolean;
  /** Manual check: prompts when an update is available, toasts otherwise. */
  check: () => Promise<void>;
  /** Open the download (direct APK on Android, release page on iOS). */
  openDownload: () => void;
};

/**
 * GitHub-release update checker for the settings screen. The TanStack Query
 * mounts as a silent auto-check (dedup + cache), and every successful fetch
 * is persisted to the update store so the hint survives restarts. Declining
 * the prompt keeps the row hint until the installed version catches up.
 */
export function useUpdateCheck(): UpdateCheckState {
  const t = useTranslate();
  const { data, dataUpdatedAt, isFetching, refetch } = useLatestRelease();
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);
  const releaseUrl = useUpdateStore((s) => s.releaseUrl);
  const apkUrl = useUpdateStore((s) => s.apkUrl);
  const recordCheck = useUpdateStore((s) => s.recordCheck);

  const currentVersion = Env.VERSION ?? '0.0.0';
  const hasUpdate = !!latestVersion && compareVersions(latestVersion, currentVersion) > 0;

  // Persist every successful check — auto or manual. `dataUpdatedAt` keeps
  // lastCheckedAt at the real fetch time even when data comes from cache.
  useEffect(() => {
    if (data) recordCheck(data, dataUpdatedAt);
  }, [data, dataUpdatedAt, recordCheck]);

  const openDownload = useCallback(() => {
    const url = Platform.OS === 'android' ? (apkUrl ?? releaseUrl) : releaseUrl;
    if (url) void Linking.openURL(url);
  }, [apkUrl, releaseUrl]);

  const check = useCallback(async () => {
    const result = await refetch();
    const release = result.data;
    if (!release) {
      showMessage({
        message: t('settings.updateCheckFailed'),
        type: 'danger',
        position: 'top',
      });
      return;
    }
    if (compareVersions(release.version, currentVersion) > 0) {
      Alert.alert(
        t('settings.updateAvailableTitle'),
        t('settings.updateAvailableMsg', {
          version: release.version,
          current: currentVersion,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.updateNow'),
            onPress: () => {
              const url =
                Platform.OS === 'android'
                  ? (release.apkUrl ?? release.releaseUrl)
                  : release.releaseUrl;
              void Linking.openURL(url);
            },
          },
        ]
      );
    } else {
      showMessage({
        message: t('settings.upToDate'),
        type: 'success',
        duration: 1500,
        position: 'top',
      });
    }
  }, [currentVersion, refetch, t]);

  return {
    checking: isFetching,
    latestVersion: latestVersion ?? undefined,
    lastCheckedAt: lastCheckedAt ?? undefined,
    hasUpdate,
    check,
    openDownload,
  };
}

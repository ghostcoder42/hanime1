import { useLatestRelease } from '@/api/update-queries';
import { useTranslate } from '@/lib/i18n/utils';
import { useUpdateStore } from '@/lib/stores/update-store';
import { type LatestRelease, compareVersions } from '@/lib/updates';
import { Env } from '@env';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

export type UpdateCheckState = {
  checking: boolean;
  /** Latest version seen from GitHub (persisted), undefined when never checked. */
  latestVersion: string | undefined;
  /** Epoch ms of the last completed check (persisted). */
  lastCheckedAt: number | undefined;
  /** True when the persisted latest version is newer than the running app. */
  hasUpdate: boolean;
  /**
   * Release found by the last manual check, when it is newer than the running
   * app. Render it with <UpdateDialog />; null means no dialog.
   */
  pendingRelease: LatestRelease | null;
  /** Manual check: opens the update dialog when newer, toasts otherwise. */
  check: () => Promise<void>;
  dismissUpdateDialog: () => void;
  /** Open the download for a release (direct APK on Android, page on iOS). */
  openReleaseDownload: (release: LatestRelease) => void;
  /** Open the download for the persisted latest release (banner-style use). */
  openDownload: () => void;
};

/**
 * GitHub-release update checker for the settings screen. The TanStack Query
 * mounts as a silent auto-check (dedup + cache), and every successful fetch
 * is persisted to the update store so the hint survives restarts. The dialog
 * only ever opens from a manual check; the silent auto-check just refreshes
 * the stored hint. Declining keeps the row hint until the installed version
 * catches up.
 */
export function useUpdateCheck(): UpdateCheckState {
  const t = useTranslate();
  const { data, dataUpdatedAt, isFetching, refetch } = useLatestRelease();
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);
  const releaseUrl = useUpdateStore((s) => s.releaseUrl);
  const apkUrl = useUpdateStore((s) => s.apkUrl);
  const recordCheck = useUpdateStore((s) => s.recordCheck);
  const [pendingRelease, setPendingRelease] = useState<LatestRelease | null>(null);

  const currentVersion = Env.VERSION ?? '0.0.0';
  const hasUpdate = !!latestVersion && compareVersions(latestVersion, currentVersion) > 0;

  // Persist every successful check — auto or manual. `dataUpdatedAt` keeps
  // lastCheckedAt at the real fetch time even when data comes from cache.
  useEffect(() => {
    if (data) recordCheck(data, dataUpdatedAt);
  }, [data, dataUpdatedAt, recordCheck]);

  const openReleaseDownload = useCallback((release: LatestRelease) => {
    const url =
      Platform.OS === 'android' ? (release.apkUrl ?? release.releaseUrl) : release.releaseUrl;
    if (url) void Linking.openURL(url);
  }, []);

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
      setPendingRelease(release);
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
    pendingRelease,
    check,
    dismissUpdateDialog: () => setPendingRelease(null),
    openReleaseDownload,
    openDownload,
  };
}

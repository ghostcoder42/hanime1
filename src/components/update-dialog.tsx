import { useTranslate } from '@/lib/i18n/utils';
import { type LatestRelease, stripMarkdown, truncateText } from '@/lib/updates';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

type UpdateDialogProps = {
  /** Release to present; null keeps the dialog closed. */
  release: LatestRelease | null;
  currentVersion: string;
  onClose: () => void;
  onDownload: (release: LatestRelease) => void;
};

/**
 * In-app replacement for the system Alert on a positive manual update check.
 * The system dialog cannot cap its height, and GitHub release notes can get
 * arbitrarily long — this card is clamped to 80% of the screen with the body
 * scrolling inside, so it stays usable no matter how much text a release has.
 */
export function UpdateDialog({ release, currentVersion, onClose, onDownload }: UpdateDialogProps) {
  const t = useTranslate();
  if (!release) return null;

  const showName =
    !!release.name && release.name !== `v${release.version}` && release.name !== release.version;
  const notes = release.notes ? truncateText(stripMarkdown(release.notes), 2000) : '';

  const meta: string[] = [];
  if (release.publishedAt) {
    meta.push(`${t('settings.releaseDate')} ${release.publishedAt.slice(0, 10)}`);
  }
  if (release.apkSize) meta.push(`APK ≈ ${(release.apkSize / 1024 / 1024).toFixed(1)} MB`);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={onClose}>
        {/* Pressable card with no onPress = tap sink, so only the backdrop
            dismisses while scrolls/buttons inside still work. */}
        <Pressable
          className="w-full max-w-md rounded-2xl bg-background p-5"
          style={{ maxHeight: '80%' }}
        >
          <Text className="text-lg font-semibold text-foreground">
            {t('settings.updateAvailableTitle')}
          </Text>

          <ScrollView className="mt-2" showsVerticalScrollIndicator={false}>
            <Text className="text-sm leading-5 text-foreground">
              {t('settings.updateAvailableMsg', {
                version: release.version,
                current: currentVersion,
              })}
            </Text>
            {meta.length > 0 ? (
              <Text className="mt-2 text-xs text-muted-foreground">{meta.join(' · ')}</Text>
            ) : null}
            {showName ? (
              <Text className="mt-3 text-sm font-medium text-foreground">{release.name}</Text>
            ) : null}
            {notes ? (
              <Text className="mt-3 text-xs leading-5 text-muted-foreground">
                {t('settings.releaseNotes')}
                {'\n'}
                {notes}
              </Text>
            ) : null}
          </ScrollView>

          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable
              onPress={onClose}
              className="rounded-full bg-muted px-4 py-2"
              accessibilityRole="button"
            >
              <Text className="text-foreground">{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onDownload(release)}
              className="rounded-full bg-primary px-4 py-2"
              accessibilityRole="button"
            >
              <Text className="text-primary-foreground">{t('settings.updateNow')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

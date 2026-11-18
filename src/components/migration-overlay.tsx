/**
 * App-front busy state for storage migrations: a blocking modal with a
 * spinner and per-video progress. Rendered once from the root layout so
 * it stays up wherever the user navigates; the migration itself is not
 * cancellable mid-file, so the modal is not dismissable.
 */
import { useTranslate } from '@/lib/i18n/utils';
import { useMigrationStore } from '@/lib/stores/migration-store';
import { ActivityIndicator, Modal, Text, View } from 'react-native';

function shorten(title: string): string {
  return title.length > 24 ? `${title.slice(0, 24)}…` : title;
}

export function MigrationOverlay() {
  const t = useTranslate();
  const { active, done, total, currentTitle } = useMigrationStore();

  return (
    <Modal transparent visible={active} animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center bg-black/60">
        <View className="w-72 gap-3 rounded-2xl bg-background px-6 py-6">
          <View className="flex-row items-center gap-3">
            <ActivityIndicator size="small" color="#f43f5e" />
            <Text className="text-base font-semibold text-foreground">
              {t('settings.migratingOverlayTitle')}
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {currentTitle
              ? t('settings.migrating', { done, total, title: shorten(currentTitle) })
              : t('settings.migratingOverlayPreparing')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

import { ScreenErrorBoundary } from '@/components/error-boundary';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { useTranslate } from '@/lib/i18n/utils';
import { clearErrorLog, readErrorLog } from '@/lib/logs/error-log';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';

export { ScreenErrorBoundary as ErrorBoundary };

/**
 * Viewer for the plain-text error log (one line per classified network
 * failure). The content is a single selectable <Text> — long-press and use
 * the system copy menu to copy any range; Share sends the whole file.
 */
export default function ErrorLogScreen() {
  const t = useTranslate();
  // null = not loaded yet, '' = empty log.
  const [log, setLog] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void readErrorLog().then(setLog);
    }, [])
  );

  const clear = async () => {
    await clearErrorLog();
    setLog('');
    showMessage({ message: t('logs.cleared'), type: 'success', position: 'top', duration: 1500 });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="text-xl font-bold text-foreground">{t('logs.title')}</Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => void Share.share({ title: t('logs.title'), message: log ?? '' })}
            disabled={!log}
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
              log ? 'bg-muted' : 'bg-muted/50'
            }`}
          >
            <Icon name="share-outline" size={14} color="#71717a" />
            <Text className="text-foreground">{t('logs.share')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void clear()}
            disabled={!log}
            className="flex-row items-center rounded-full bg-muted/50 px-3 py-1.5"
          >
            <Text className="text-rose-400">{t('logs.clear')}</Text>
          </Pressable>
        </View>
      </View>

      <Text className="px-4 pb-2 text-xs leading-4 text-muted-foreground">
        {t('logs.copyHint')}
      </Text>

      {log === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fb7185" />
        </View>
      ) : log === '' ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">{t('logs.empty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <Text selectable className="px-4 text-xs leading-5 text-foreground">
            {log}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

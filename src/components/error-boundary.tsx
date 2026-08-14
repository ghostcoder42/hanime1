import { SafeAreaView } from '@/components/safe-area-view';
import { useTranslate } from '@/lib/i18n/utils';
import type { PropsWithChildren } from 'react';
import { type FallbackProps, ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Pressable, ScrollView, Text } from 'react-native';

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  const t = useTranslate();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-lg font-semibold text-foreground">{t('common.error')}</Text>
      {__DEV__ ? (
        <ScrollView className="mt-2 max-h-40 max-w-full">
          <Text className="text-xs text-muted-foreground">{message}</Text>
        </ScrollView>
      ) : null}
      <Pressable onPress={resetErrorBoundary} className="mt-4 rounded-full bg-primary px-4 py-2">
        <Text className="text-primary-foreground">{t('common.retry')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export function ErrorBoundary({ children }: PropsWithChildren) {
  return <ReactErrorBoundary FallbackComponent={Fallback}>{children}</ReactErrorBoundary>;
}

/**
 * Screen-level error boundary for expo-router. Export this from any screen
 * module as `ErrorBoundary` and expo-router will automatically wrap that
 * screen in a `Try` component — errors are caught per-screen instead of
 * crashing the entire navigator.
 *
 * Usage in a screen file:
 * ```ts
 * export { ScreenErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
 * ```
 */
export function ScreenErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const t = useTranslate();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-lg font-semibold text-foreground">{t('common.error')}</Text>
      {__DEV__ ? (
        <ScrollView className="mt-2 max-h-40 max-w-full">
          <Text className="text-xs text-muted-foreground">{message}</Text>
        </ScrollView>
      ) : null}
      <Pressable onPress={retry} className="mt-4 rounded-full bg-primary px-4 py-2">
        <Text className="text-primary-foreground">{t('common.retry')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

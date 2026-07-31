import '../../global.css';
import '@/lib/i18n';
import { APIProvider } from '@/api/common/api-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { Icon } from '@/components/icon';
import { FlexGestureHandlerRootView } from '@/components/native-styled';
import { SafeAreaView } from '@/components/safe-area-view';
import { PrivacyShield } from '@/components/security/PrivacyShield';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { useThemeConfig } from '@/lib/hooks';
import { useDownloadedStore } from '@/lib/stores';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, Pressable, View, useColorScheme as useRNColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Compact, themed header for the watch detail screen: just a back chevron, no
 * title (the video title is shown in the body). Shorter than the default native
 * bar and uses the app background so it matches light/dark mode. The SafeAreaView
 * top edge fills behind the status bar so it never overlaps it.
 */
function WatchHeader({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView edges={['top']} className="bg-background">
      <View className="h-9 flex-row items-center">
        <Pressable hitSlop={12} className="px-2" onPress={onBack} accessibilityLabel="Back">
          <Icon name="chevron-back" size={26} color="#fb7185" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [theme] = useThemeConfig();
  const systemScheme = useRNColorScheme();
  // Resolve to a concrete 'light' | 'dark'. Both GluestackUIProvider (via its
  // `mode` prop) and NativeWind (via Appearance.getColorScheme()) must agree, so
  // drive Appearance from this single resolved value. Do NOT pass 'unspecified'
  // here: that makes getColorScheme() return null, which NativeWind treats as
  // light — desyncing it from gluestack (white screens under dark mode).
  const resolvedMode: 'light' | 'dark' =
    theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : theme;
  const hydrate = useDownloadedStore((s) => s.hydrate);

  useEffect(() => {
    Appearance.setColorScheme(resolvedMode);
  }, [resolvedMode]);

  useEffect(() => {
    void hydrate();
    SplashScreen.hideAsync().catch(() => {});
  }, [hydrate]);

  return (
    <FlexGestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <GluestackUIProvider mode={resolvedMode}>
            <ErrorBoundary>
              <PrivacyShield>
                <APIProvider>
                  <StatusBar style="auto" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: 'transparent' },
                    }}
                  >
                    <Stack.Screen name="(app)" />
                    <Stack.Screen
                      name="watch/[id]"
                      options={{
                        headerShown: true,
                        title: '',
                        header: ({ navigation }) => (
                          <WatchHeader onBack={() => navigation.goBack()} />
                        ),
                      }}
                    />
                    <Stack.Screen
                      name="user/[id]"
                      options={{
                        headerShown: true,
                        headerBackTitle: 'Back',
                        headerTintColor: '#fb7185',
                      }}
                    />
                    <Stack.Screen
                      name="tag/[name]"
                      options={{
                        headerShown: true,
                        headerBackTitle: 'Back',
                        headerTintColor: '#fb7185',
                      }}
                    />
                  </Stack>
                </APIProvider>
              </PrivacyShield>
            </ErrorBoundary>
          </GluestackUIProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </FlexGestureHandlerRootView>
  );
}

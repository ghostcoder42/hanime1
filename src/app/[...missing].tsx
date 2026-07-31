import { SafeAreaView } from '@/components/safe-area-view';
import { useTranslate } from '@/lib/i18n/utils';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  const t = useTranslate();
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background">
      <View className="items-center">
        <Text className="text-lg font-semibold text-foreground">404</Text>
        <Text className="mt-1 text-muted-foreground">{t('common.noResults')}</Text>
        <Link href="/" className="mt-4 rounded-full bg-primary px-4 py-2">
          <Text className="text-primary-foreground">{t('tabs.browse')}</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

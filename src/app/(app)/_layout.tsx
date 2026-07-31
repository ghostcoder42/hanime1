import { Icon } from '@/components/icon';
import { useTranslate } from '@/lib/i18n/utils';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AppTabsLayout() {
  const t = useTranslate();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fb7185',
        tabBarInactiveTintColor: isDark ? '#a1a1aa' : '#71717a',
        tabBarStyle: {
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
          borderTopColor: isDark ? '#2e2e2e' : '#e5e5e5',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.browse'),
          tabBarIcon: ({ color }) => <Icon name="grid" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color }) => <Icon name="library" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <Icon name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

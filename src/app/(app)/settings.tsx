import { queryClient } from '@/api/common/query-client';
import { SafeAreaView } from '@/components/safe-area-view';
import { SITE_DOMAINS, SITE_DOMAIN_KEY, type SiteDomain } from '@/lib/hanime1/endpoints';
import { type ThemeMode, useThemeConfig } from '@/lib/hooks';
import { useSecuritySettings } from '@/lib/hooks/use-security-settings';
import { LANGUAGE_LABELS, type Language } from '@/lib/i18n/resources';
import type { TxKeyPath } from '@/lib/i18n/types';
import { useSelectedLanguage, useTranslate } from '@/lib/i18n/utils';
import { useDownloadedStore, useHistoryStore } from '@/lib/stores';
import { Env } from '@env';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useMMKVString } from 'react-native-mmkv';

const VERSION = Env.VERSION ?? '1.0.0';

const THEME_LABELS: Record<ThemeMode, TxKeyPath> = {
  system: 'settings.themeSystem',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
};

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="max-w-[60%]">
        <Text className="text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      <View className="flex-row">{children}</View>
    </View>
  );
}

function Pill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full px-3 py-1.5 ${active ? 'bg-primary' : 'bg-muted'}`}
    >
      <Text className={active ? 'text-primary-foreground' : 'text-foreground'}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const t = useTranslate();
  const [theme, setTheme] = useThemeConfig();
  const [domain, setDomain] = useMMKVString(SITE_DOMAIN_KEY);
  const [lang, setLang] = useSelectedLanguage();
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const clearDownloads = useDownloadedStore((s) => s.clearAll);
  const { hidePreview, setHidePreview } = useSecuritySettings();
  const currentDomain = (domain ?? SITE_DOMAINS[0]) as SiteDomain;

  const changeDomain = (d: SiteDomain) => {
    setDomain(d);
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['video'] });
    showMessage({ message: d, type: 'success', duration: 1500 });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="px-4 pb-2 pt-2 text-2xl font-bold text-foreground">
          {t('settings.title')}
        </Text>

        <SectionTitle>{t('settings.appearance')}</SectionTitle>
        <Row label={t('settings.theme')}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
            <Pill
              key={mode}
              active={theme === mode}
              label={t(THEME_LABELS[mode])}
              onPress={() => setTheme(mode)}
            />
          ))}
        </Row>

        <SectionTitle>{t('settings.domain')}</SectionTitle>
        <Row label={t('settings.domain')} description={t('settings.domainDescription')}>
          {SITE_DOMAINS.map((d) => (
            <Pill
              key={d}
              active={currentDomain === d}
              label={d.replace('https://', '')}
              onPress={() => changeDomain(d)}
            />
          ))}
        </Row>

        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Row label={t('settings.language')}>
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => (
            <Pill
              key={l}
              active={lang === l}
              label={LANGUAGE_LABELS[l]}
              onPress={() => setLang(l)}
            />
          ))}
        </Row>

        <SectionTitle>{t('settings.security')}</SectionTitle>
        <Pressable
          android_ripple={{ color: '#00000020' }}
          onPress={() => setHidePreview(!hidePreview)}
        >
          <Row label={t('settings.hidePreview')}>
            <Text className={hidePreview ? 'text-rose-500' : 'text-muted-foreground'}>
              {t(hidePreview ? 'common.on' : 'common.off')}
            </Text>
          </Row>
        </Pressable>

        <SectionTitle>{t('settings.data')}</SectionTitle>
        <Pressable android_ripple={{ color: '#00000020' }} onPress={() => clearHistory()}>
          <Row label={t('settings.clearHistory')}>
            <Text className="text-rose-400">{t('common.clear')}</Text>
          </Row>
        </Pressable>
        <Pressable android_ripple={{ color: '#00000020' }} onPress={() => void clearDownloads()}>
          <Row label={t('library.downloads')}>
            <Text className="text-rose-400">{t('common.clear')}</Text>
          </Row>
        </Pressable>

        <SectionTitle>{t('settings.about')}</SectionTitle>
        <Row label={t('settings.version')}>
          <Text className="text-muted-foreground">{VERSION}</Text>
        </Row>
      </ScrollView>
    </SafeAreaView>
  );
}

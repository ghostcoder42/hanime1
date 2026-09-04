import { queryClient } from '@/api/common/query-client';
import { ScreenErrorBoundary } from '@/components/error-boundary';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { UpdateDialog } from '@/components/update-dialog';
import { SITE_DOMAINS, SITE_DOMAIN_KEY, type SiteDomain } from '@/lib/hanime1/endpoints';
import { type ThemeMode, useThemeConfig } from '@/lib/hooks';
import { useSecuritySettings } from '@/lib/hooks/use-security-settings';
import { useUpdateCheck } from '@/lib/hooks/use-update-check';
import { LANGUAGE_LABELS, type Language } from '@/lib/i18n/resources';
import type { TxKeyPath } from '@/lib/i18n/types';
import { useSelectedLanguage, useTranslate } from '@/lib/i18n/utils';
import { useDownloadedStore, useHistoryStore } from '@/lib/stores';
import { Env } from '@env';
// Namespace import: named imports from this package break under Metro's lazy
// bundles (binding missing at runtime), destructuring after import works.
import * as ApplicationNS from 'expo-application';
import { ActivityAction, startActivityAsync } from 'expo-intent-launcher';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useMMKVString } from 'react-native-mmkv';

const { applicationId } = ApplicationNS;

const VERSION = Env.VERSION ?? '1.0.0';

/**
 * Open the system screen where the user can allow this app to handle the
 * site domains. The domains can't pass server-side verification (we don't
 * own them), so each one must be enabled by hand — Android 12+ silently
 * routes unverified/unselected links to the browser without asking.
 * Tries the direct "Open by default" screen (Android 12+), falls back to
 * the app details screen where that entry lives.
 */
const openAppLinkSettings = async () => {
  const params = { data: `package:${applicationId}` };
  try {
    await startActivityAsync(ActivityAction.APP_OPEN_BY_DEFAULT_SETTINGS, params);
  } catch {
    await startActivityAsync(ActivityAction.APPLICATION_DETAILS_SETTINGS, params);
  }
};

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
  /** Plain string gets the standard muted style; a node renders as-is (rich text). */
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="max-w-[60%]">
        <Text className="text-foreground">{label}</Text>
        {description ? (
          typeof description === 'string' ? (
            <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
          ) : (
            description
          )
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

export { ScreenErrorBoundary as ErrorBoundary };

export default function SettingsScreen() {
  const t = useTranslate();
  const [theme, setTheme] = useThemeConfig();
  const [domain, setDomain] = useMMKVString(SITE_DOMAIN_KEY);
  const [lang, setLang] = useSelectedLanguage();
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const clearDownloads = useDownloadedStore((s) => s.clearAll);
  const { hidePreview, setHidePreview } = useSecuritySettings();
  const update = useUpdateCheck();
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

        {Platform.OS === 'android' ? (
          <>
            <SectionTitle>{t('settings.openLinks')}</SectionTitle>
            <Text className="px-4 pb-1 text-xs leading-4 text-muted-foreground">
              {t('settings.openLinksDescription')}
            </Text>
            <Pressable
              android_ripple={{ color: '#00000020' }}
              onPress={() => void openAppLinkSettings()}
            >
              <Row label={SITE_DOMAINS.map((d) => d.replace('https://', '')).join(' / ')}>
                <Text className="text-rose-500">{t('settings.enableLinks')}</Text>
              </Row>
            </Pressable>
          </>
        ) : null}

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
        <Pressable
          android_ripple={{ color: '#00000020' }}
          onPress={() => void update.check()}
          disabled={update.checking}
        >
          <Row
            label={t('settings.checkUpdates')}
            description={
              update.hasUpdate ? (
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {t('settings.updateAvailablePrefix')}{' '}
                  <Text className="font-semibold text-rose-500">{update.latestVersion}</Text>{' '}
                  {t('settings.updateAvailableSuffix')}
                </Text>
              ) : undefined
            }
          >
            {/* Pill-shaped button so the row reads as actionable (the old muted
                text looked disabled); swaps to a spinner + "checking" label
                while the request is in flight. View, not Pressable — the whole
                row is the tap target. */}
            <View
              className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
                update.checking ? 'bg-muted' : 'bg-primary'
              }`}
            >
              {update.checking ? (
                <ActivityIndicator size="small" color="#fb7185" />
              ) : (
                <Icon name="refresh" size={16} color="white" />
              )}
              <Text className={update.checking ? 'text-foreground' : 'text-primary-foreground'}>
                {t(update.checking ? 'settings.checking' : 'settings.checkNow')}
              </Text>
            </View>
          </Row>
        </Pressable>
        <Row label={t('settings.version')}>
          <Text className="text-muted-foreground">{VERSION}</Text>
        </Row>
      </ScrollView>

      <UpdateDialog
        release={update.pendingRelease}
        currentVersion={VERSION}
        onClose={update.dismissUpdateDialog}
        onDownload={update.openReleaseDownload}
      />
    </SafeAreaView>
  );
}

import path from 'node:path';
/* eslint-disable max-lines-per-function */
import type { ConfigContext, ExpoConfig } from '@expo/config';
import dotenv from 'dotenv';
import { z } from 'zod';
import type { ClientEnv } from './src/types/env';

// ── Build-time environment (inlined from the former root env.js) ────────────
// @expo/config evaluates app.config.ts by transpiling only this entry file and
// `eval`-ing it, so any imported module would have to be plain JS. Keeping the
// env logic inline (rather than in a separate ./env) lets it be TypeScript.

const APP_ENV = process.env.APP_ENV ?? 'development';
dotenv.config({ path: path.resolve(__dirname, `.env.${APP_ENV}`) });

const BUNDLE_ID = 'app.hanime1'; // ios bundle id
const PACKAGE = 'app.hanime1'; // android package name
const APP_DISPLAY_NAME = 'HAnime1'; // app name
const SCHEME = 'hanime1'; // app scheme

/** Per-env suffix for bundle id / package name (e.g. app.hanime1.test). */
const ENV_SUFFIX: Record<string, string> = {
  development: 'test',
  staging: 'staging',
};
const withEnvSuffix = (name: string): string =>
  APP_ENV === 'production' ? name : `${name}.${ENV_SUFFIX[APP_ENV] ?? APP_ENV}`;

/** Per-env display name suffix (e.g. "HAnime1 (Test)"). */
const ENV_NAME_LABEL: Record<string, string> = {
  development: ' (Test)',
  staging: ' (Staging)',
};
const NAME =
  APP_ENV === 'production'
    ? APP_DISPLAY_NAME
    : `${APP_DISPLAY_NAME}${ENV_NAME_LABEL[APP_ENV] ?? ''}`;

const client = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  NAME: z.string(),
  SCHEME: z.string(),
  BUNDLE_ID: z.string(),
  PACKAGE: z.string(),
  VERSION: z.string(),
  API_URL: z.string().default('https://hanimeone.me'),
});

const buildTime = z.object({
  SECRET_KEY: z.string().default(''),
});

const packageJSON = require('./package.json') as { version: string };

const _clientEnv = {
  APP_ENV,
  NAME,
  SCHEME,
  BUNDLE_ID: withEnvSuffix(BUNDLE_ID),
  PACKAGE: withEnvSuffix(PACKAGE),
  VERSION: packageJSON.version,
  API_URL: process.env.API_URL,
};

const _buildTimeEnv = {
  SECRET_KEY: process.env.SECRET_KEY,
};

const merged = buildTime.merge(client);
const parsed = merged.safeParse({ ..._clientEnv, ..._buildTimeEnv });

if (parsed.success === false) {
  console.error(
    '❌ Invalid environment variables:',
    parsed.error.flatten().fieldErrors,
    `\n❌ Missing variables in .env.${APP_ENV} file, Make sure all required variables are defined in the .env.${APP_ENV} file.`,
    `\n💡 Tip: If you recently updated the .env.${APP_ENV} file and the error still persists, try restarting the server with the -c flag to clear the cache.`
  );
  throw new Error('Invalid environment variables, Check terminal for more details ');
}

const Env = parsed.data;
// Aligns the zod-inferred shape with the shared ClientEnv interface.
const clientEnv: ClientEnv = client.parse(_clientEnv);

const EAS_PROJECT_ID: string = process.env.EAS_PROJECT_ID ?? '';
const EXPO_ACCOUNT_OWNER: string = process.env.EXPO_ACCOUNT_OWNER ?? '';

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    name: Env.NAME,
    description: `${Env.NAME} Mobile App`,
    owner: EXPO_ACCOUNT_OWNER,
    scheme: Env.SCHEME,
    slug: 'hanime1',
    version: Env.VERSION.toString(),
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: Env.BUNDLE_ID,
      // Universal links for both site mirrors. Verification requires each
      // domain to serve an AASA file (apple-app-site-association); until then
      // the app is still listed as a candidate handler for tapped links.
      associatedDomains: ['applinks:hanime1.me', 'applinks:hanimeone.me'],
      config: {
        usesNonExemptEncryption: false, // Avoid the export compliance warning on the app store
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: APP_ENV === 'production' ? '#0a0a0a' : '#0a0a2e',
      },
      package: Env.PACKAGE,
      // App links for both site mirrors so hanime1.me / hanimeone.me URLs
      // (e.g. /watch?v=123) open in the app instead of the browser. One filter
      // per host: sharing a filter makes verification all-or-nothing across
      // hosts, so a failing mirror would break the working one too.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'hanime1.me' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'hanimeone.me' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
        },
      ],
      'expo-font',
      'expo-video',
      'expo-image',
      'expo-localization',
      // Blank the app in the recents/app-switcher and block screenshots/recording.
      ['react-native-capture-protection', { captureType: 'base' }],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...clientEnv,
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  }) as ExpoConfig;

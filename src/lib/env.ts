/*
 * Runtime entry for the client env (`@env`). Reads the `extra` block that
 * app.config.ts baked in at build time. The shape is the shared ClientEnv type.
 * If you import `Env` from `@env`, this is the file that loads — you can only
 * access client env variables here.
 */
import type { ClientEnv } from '@/types/env';
import Constants from 'expo-constants';

export const Env = (Constants.expoConfig?.extra ?? {}) as ClientEnv;

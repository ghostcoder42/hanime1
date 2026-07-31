/** Shape of the client-side env (the `extra` block in app.config.ts / `@env`). */
export interface ClientEnv {
  APP_ENV: 'development' | 'staging' | 'production';
  NAME: string;
  SCHEME: string;
  BUNDLE_ID: string;
  PACKAGE: string;
  VERSION: string;
  API_URL: string;
}

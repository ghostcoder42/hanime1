import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Deep-link entry for site watch URLs. Incoming links use the site's shape
 * `https://hanime1.me/watch?v=123` (also `hanime1://watch?v=123` via the custom
 * scheme), where the id is a query param — this screen rewrites it to the
 * app-native `/watch/123` route. `/user/{id}` links already match the app's
 * `/user/[id]` route directly and need no rewrite.
 */
export default function WatchRedirectScreen() {
  const { v } = useLocalSearchParams<{ v?: string }>();
  if (v) {
    return <Redirect href={{ pathname: '/watch/[id]', params: { id: v } }} />;
  }
  return <Redirect href="/" />;
}

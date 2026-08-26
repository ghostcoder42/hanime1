import { Redirect, useLocalSearchParams } from 'expo-router';

/** First value of a query param that expo-router may deliver as string | string[]. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Deep-link entry for site search URLs. Nearly every site page is a
 * `/search?...` URL: free-text (`?query=絕區零`), attribute filters
 * (`?tags[]=巨乳`, percent-encoded as `tags%5B%5D`), or just sort/genre
 * (the site's landing page). The app has no `/search` route, so rewrite each
 * shape onto the closest native screen — the tag page is itself a search
 * results screen, and bare browse-style URLs land on the home feed.
 */
export default function SearchRedirectScreen() {
  const params = useLocalSearchParams();
  const query = firstParam(params.query);
  const rawTag = firstParam(params['tags[]']) ?? firstParam(params['tags%5B%5D']);

  if (query) {
    return <Redirect href={{ pathname: '/tag/[name]', params: { name: query, type: 'query' } }} />;
  }
  if (rawTag) {
    return <Redirect href={{ pathname: '/tag/[name]', params: { name: rawTag, type: 'tag' } }} />;
  }
  return <Redirect href="/" />;
}

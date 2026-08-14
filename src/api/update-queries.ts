import { type LatestRelease, fetchLatestRelease } from '@/lib/updates';
import { createQuery } from 'react-query-kit';

/**
 * Latest GitHub release for the update check. Mounting the query is the
 * silent auto-check (deduped + cached by TanStack Query); calling `refetch`
 * is the manual one (bypasses staleTime). A 24h staleTime (overriding the
 * global 5min) throttles the auto-check to once a day — opening Settings
 * within 24h of the last check serves the cached result instead. Throws on
 * failure so the client's retry policy applies.
 */
export const useLatestRelease = createQuery<LatestRelease, void, Error>({
  queryKey: ['update', 'latest-release'],
  fetcher: async () => {
    const release = await fetchLatestRelease();
    if (!release) throw new Error('Failed to fetch latest release');
    return release;
  },
  staleTime: 1000 * 60 * 60 * 24, // auto-check at most once per day
});

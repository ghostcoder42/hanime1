/**
 * App-update checks against the project's GitHub Releases.
 *
 * The release workflow publishes `HAnime1-<version>.apk` (Android) and an
 * unsigned `.ipa` (iOS) on every `v*` tag. We compare the latest release's
 * tag with the running app version — a newer tag means an update is
 * available. Pure logic only (no React Native imports) so it stays testable.
 */

export const GITHUB_REPO = 'ghostcoder42/hanime1';
const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const FETCH_TIMEOUT_MS = 10_000;

export type LatestRelease = {
  /** Version parsed from the release tag (leading `v` stripped). */
  version: string;
  /** Human-facing release page (works on every platform). */
  releaseUrl: string;
  /** Direct APK download URL when the release has one (null otherwise). */
  apkUrl: string | null;
};

type GithubReleaseAsset = { name?: unknown; browser_download_url?: unknown };
type GithubReleaseJson = { tag_name?: unknown; html_url?: unknown; assets?: unknown };

/** Compare dotted numeric versions ("v0.2.0" vs "0.1.1") → -1 | 0 | 1. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

/** Normalize the GitHub `/releases/latest` payload; null when unusable. */
export function parseGithubRelease(json: unknown): LatestRelease | null {
  if (!json || typeof json !== 'object') return null;
  const data = json as GithubReleaseJson;
  const tag = typeof data.tag_name === 'string' ? data.tag_name.replace(/^v/, '').trim() : '';
  if (!tag || !/^\d+(\.\d+)*$/.test(tag)) return null;

  const releaseUrl =
    typeof data.html_url === 'string' && data.html_url
      ? data.html_url
      : `https://github.com/${GITHUB_REPO}/releases/latest`;

  let apkUrl: string | null = null;
  if (Array.isArray(data.assets)) {
    for (const asset of data.assets as GithubReleaseAsset[]) {
      if (
        typeof asset.name === 'string' &&
        asset.name.endsWith('.apk') &&
        typeof asset.browser_download_url === 'string'
      ) {
        apkUrl = asset.browser_download_url;
        break;
      }
    }
  }
  return { version: tag, releaseUrl, apkUrl };
}

/** Fetch the latest published release from GitHub (null on any failure). */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'hanime1-app' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return parseGithubRelease(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

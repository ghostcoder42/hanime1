/**
 * HTML scraper for hanimeone.me.
 *
 * Site is a server-rendered Laravel app. Watch pages embed signed MP4
 * `<source>` URLs directly — no API, no auth, no HLS for the common case.
 *
 * ⚠️ Hermes (RN's JS engine) does **not** populate `matchAll(...).groups` for
 * named captures the way V8 does. We therefore use **positional** capture
 * groups (`match[1..n]`) exclusively and avoid `.groups`.
 */
import { buildSearchUrl, buildUrl, endpoints } from './endpoints';
import type { ListResult, VideoDetail, VideoListItem, VideoSource } from './types';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15_000;

/** Iterate all regex matches positionally (Hermes-safe; no `.groups`). */
function forEachMatch(input: string, pattern: RegExp, cb: (m: RegExpExecArray) => void): void {
  pattern.lastIndex = 0;
  let m = pattern.exec(input);
  while (m !== null) {
    cb(m);
    m = pattern.exec(input);
  }
}

/** Fetch a page as text with a desktop UA + timeout. */
export async function fetchPage(pathOrUrl: string): Promise<string> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : buildUrl(pathOrUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}): ${url}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function decode(text: string): string {
  try {
    return decodeHTMLEntities(text);
  } catch {
    return text;
  }
}

/** Decode the handful of HTML entities the site emits inside text fields. */
export function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function firstMatch(html: string, pattern: RegExp): string | undefined {
  const m = html.match(pattern);
  return m?.[1] ? decode(m[1].trim()) : undefined;
}

/**
 * Parse a single video card from the inner HTML of its wrapping
 * `<a href="watch?v=ID">` anchor. The homepage (`/search?sort=…`) cards are
 * rich (`main-thumb`, `duration`, `stat-item`, `subtitle`), while genre/search
 * cards (`/search?genre=…`) are minimal (`<img>` + `home-rows-videos-title`),
 * so each field has a fallback. Returns null if the anchor has no `<img>`
 * (i.e. not actually a card — filters out stray text links).
 */
function parseCard(id: string, inner: string): VideoListItem | null {
  if (!/<img/i.test(inner)) return null;

  const thumbnail =
    firstMatch(inner, /class="main-thumb"\s+src="([^"]+)"/) ??
    firstMatch(inner, /<img[^>]*src="([^"]+)"/i);

  const title =
    firstMatch(inner, /class="home-rows-videos-title">\s*([^<]+)</) ??
    firstMatch(inner, /class="title">([^<]+)</);

  const duration = firstMatch(inner, /class="duration">\s*([^<]+)</);
  const author = firstMatch(inner, /class="subtitle">\s*<a[^>]*>([^<]+)</);
  const uploadedRelative = firstMatch(inner, /class="subtitle-time">([^<]+)</);

  // stat-items: [0] = like ratio (wraps a thumb_up icon), [1] = views text
  const stats: string[] = [];
  forEachMatch(inner, /<div class="stat-item">([\s\S]*?)<\/div>/g, (mm) => {
    stats.push(stripTags(mm[1]).trim());
  });
  const likeRatio = stats[0]?.replace('thumb_up', '').trim();
  const views = stats[1]?.trim();

  return {
    id,
    title: title ?? '',
    thumbnail: thumbnail ?? '',
    duration,
    views,
    likeRatio,
    author,
    uploadedRelative,
  };
}

/** Parse the "next page" / "last page" signals from a search/browse page. */
function parsePagination(
  html: string,
  currentPage: number
): {
  nextPage: number | null;
  lastPage: number | null;
} {
  const hasNext = /aria-label="pagination\.next"/.test(html);
  const pageMatches = html.match(/page=(\d+)/g);
  let lastPage: number | null = null;
  if (pageMatches && pageMatches.length > 0) {
    lastPage = Math.max(...pageMatches.map((s) => Number.parseInt(s.replace('page=', ''), 10)));
  }
  return {
    nextPage: hasNext ? currentPage + 1 : null,
    lastPage,
  };
}

/**
 * Parse a search/browse/home page into items + pagination. The homepage feed
 * (`/search?sort=…`) and genre/search pages (`/search?genre=…`) both wrap every
 * card in a `<a href="watch?v=ID">` anchor, so we extract by anchor — that
 * handles both card layouts (`video-item-container` on home, `home-rows-videos`
 * on search) and naturally skips sponsored ads (their anchors point to an
 * external URL with no `watch?v=` id).
 */
export function parseVideoList(html: string, currentPage = 1): ListResult<VideoListItem> {
  const items: VideoListItem[] = [];
  forEachMatch(html, /<a\s[^>]*href="[^"]*watch\?v=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (m) => {
    const item = parseCard(m[1], m[2]);
    if (item) items.push(item);
  });
  const pagination = parsePagination(html, currentPage);
  return { items, nextPage: pagination.nextPage, lastPage: pagination.lastPage };
}

/** Extract all MP4 `<source>` resolutions from a watch page. */
function parseSources(html: string): VideoSource[] {
  const sources: VideoSource[] = [];
  forEachMatch(html, /<source\s+src="([^"]+)"\s+type="video\/mp4"\s+size="(\d+)">/g, (mm) => {
    const url = mm[1];
    const resolution = Number.parseInt(mm[2], 10);
    if (url) sources.push({ resolution, url });
  });
  // Fallback: some players emit a single source without `size`, or an m3u8.
  if (sources.length === 0) {
    const any = firstMatch(html, /<source\s+src="([^"]+)"/);
    if (any) sources.push({ resolution: 0, url: any });
    const hls = firstMatch(html, /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
    if (hls) sources.push({ resolution: 0, url: hls });
  }
  // Highest resolution first for convenient default selection.
  return sources.sort((a, b) => b.resolution - a.resolution);
}

function parseTags(html: string): string[] {
  const tags = new Set<string>();
  // structured content tags: <a href="/search?tags[]=TAG">TAG</a>
  forEachMatch(html, /href="\/search\?tags\[\]=([^"&]+)"/g, (mm) => {
    if (mm[1]) tags.add(decode(decodeURIComponent(mm[1])));
  });
  // free-text tags: <a href="/search?query=TXT"># TXT</a>
  forEachMatch(html, /href="\/search\?query=([^"&]+)"[^>]*>#?\s*([^<]+)</g, (mm) => {
    const label = mm[2]?.trim();
    if (label && !label.startsWith('http')) tags.add(decode(label));
  });
  return [...tags];
}

/** Parse a `/watch?v=ID` page into a full video detail with stream sources. */
export function parseVideoDetail(html: string, id: string): VideoDetail {
  const ogTitle = firstMatch(html, /<meta\s+property="og:title"\s+content="([^"]*)"/);
  const ogDesc = firstMatch(html, /<meta\s+property="og:description"\s+content="([^"]*)"/);
  const ogImage = firstMatch(html, /<meta\s+property="og:image"\s+content="([^"]*)"/);

  const title =
    firstMatch(html, /id="shareBtn-title"[^>]*>([^<]+)</) ??
    ogTitle ??
    firstMatch(html, /<title>([^<]+)<\/title>/) ??
    '';

  const author = firstMatch(html, /id="video-artist-name"[^>]*>([^<]+)</);
  const authorId = firstMatch(html, /href="https?:\/\/[^/]*\/user\/(\d+)"/);
  const genre = firstMatch(html, /href="\/search\?genre=([^"&]+)"/);

  // "觀看次數：1.1萬次  2026-07-22"
  const viewsBlock = firstMatch(html, /觀看次數[：:]\s*([^\n<]*)/);
  const uploadedDate = viewsBlock?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const viewsText = viewsBlock?.replace(/\d{4}-\d{2}-\d{2}/, '').trim();

  const likePercent = firstMatch(html, /id="video-like-btn"[\s\S]*?(\d+%)&nbsp;/);

  const description =
    firstMatch(html, /class="video-caption-text[^"]*">([\s\S]*?)<\/div>/) ?? ogDesc;
  const sources = parseSources(html);

  return {
    id,
    title: title.trim(),
    thumbnail: ogImage ?? '',
    thumbnailHi: ogImage,
    author,
    authorId,
    genre: genre ? decode(decodeURIComponent(genre)) : undefined,
    viewsText,
    uploadedDate,
    likePercent,
    description: description ? decode(stripTags(description).trim()) : undefined,
    tags: parseTags(html),
    sources,
  };
}

// ── High-level helpers used by the API layer ──────────────────────────────

export async function fetchVideoList(params: {
  sort?: string;
  query?: string;
  genre?: string;
  tags?: string[];
  broad?: boolean;
  page: number;
}): Promise<ListResult<VideoListItem>> {
  const html = await fetchPage(buildSearchUrl(params));
  return parseVideoList(html, params.page);
}

export async function fetchVideoDetail(id: string): Promise<VideoDetail> {
  const html = await fetchPage(endpoints.watch(id));
  return parseVideoDetail(html, id);
}

/**
 * Fetch a single page of a user's uploaded videos. The site's `/user/{id}`
 * page renders the same `video-item-container` cards but exposes no pagination
 * markup, so this returns a single (first) page with `nextPage: null`.
 */
export async function fetchUserVideos(id: string): Promise<ListResult<VideoListItem>> {
  const html = await fetchPage(endpoints.user(id));
  return parseVideoList(html, 1);
}

export { buildSearchUrl, buildUrl, endpoints };

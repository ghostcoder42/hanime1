import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseVideoDetail, parseVideoList } from './scraper';

function fixture(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
}

/**
 * Helpers that assert STRUCTURE rather than values tied to the moment the
 * fixture was captured. Counts and `lastPage` grow over time on the live site,
 * so we assert ranges + relationships + per-item shape — these stay valid when
 * the fixture is re-cached.
 */
function expectWellFormedItems(items: ReturnType<typeof parseVideoList>['items']) {
  expect(items.length).toBeGreaterThan(0);
  const ids = new Set<string>();
  for (const item of items) {
    expect(item.id).toMatch(/^\d+$/);
    expect(ids.has(item.id)).toBe(false); // no duplicate ids
    ids.add(item.id);
    expect(item.title.length).toBeGreaterThan(0);
    expect(item.thumbnail).toMatch(/^https?:\/\//);
    // cards must never leak the external sponsored-ad domain
    expect(item.thumbnail).not.toContain('erodalabs');
  }
}

describe('parseVideoList — homepage feed', () => {
  // /search?sort=最新上傳 — rich cards (video-item-container) with stats.
  const result = parseVideoList(fixture('video-list.html'), 1);

  it('parses a full page of cards and skips sponsored ads', () => {
    // A real page has dozens of cards; the 2 erodalabs ads (external href, no
    // watch?v= id) are filtered. Asserting a range survives re-caching.
    expect(result.items.length).toBeGreaterThan(50);
    expectWellFormedItems(result.items);
  });

  it('extracts duration + like ratio + views from the rich layout', () => {
    const item = result.items[0];
    expect(item.duration).toMatch(/^\d+:\d+$/);
    expect(item.likeRatio).toMatch(/%$/);
    expect(item.views).toBeTruthy();
  });

  it('reads pagination relationships (not the volatile last-page number)', () => {
    expect(result.nextPage).toBe(2); // page 1 always advances to 2 on a multi-page feed
    expect(result.lastPage).toBeGreaterThan(1);
  });
});

describe('parseVideoList — genre search page', () => {
  // /search?genre=裏番 — minimal cards (home-rows-videos) with only title +
  // thumbnail. The anchor-based parser must handle both layouts.
  const result = parseVideoList(fixture('video-list-genre.html'), 1);

  it('parses genre cards and skips the erolabs ad', () => {
    expect(result.items.length).toBeGreaterThan(30);
    expectWellFormedItems(result.items);
  });

  it('has pagination', () => {
    expect(result.lastPage).toBeGreaterThan(1);
  });
});

describe('parseVideoDetail', () => {
  const detail = parseVideoDetail(fixture('video-detail.html'), '407277');

  it('keeps the passed id', () => {
    expect(detail.id).toBe('407277');
  });

  it('parses a non-empty title', () => {
    expect(detail.title.length).toBeGreaterThan(0);
  });

  it('parses MP4 sources sorted by resolution desc (each signed)', () => {
    expect(detail.sources.length).toBeGreaterThan(0);
    const resolutions = detail.sources.map((s) => s.resolution);
    const sorted = [...resolutions].sort((a, b) => b - a);
    expect(resolutions).toEqual(sorted); // highest first
    for (const s of detail.sources) {
      expect(s.url).toContain('.mp4');
      expect(s.url).toContain('secure='); // signed URL — required for playback
    }
  });

  it('parses views + upload date', () => {
    expect(detail.uploadedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail.viewsText).toContain('次');
  });

  it('parses an author when present', () => {
    expect(typeof detail.author).toBe('string');
  });
});

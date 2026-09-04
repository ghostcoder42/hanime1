import { compareVersions, parseGithubRelease, stripMarkdown, truncateText } from './updates';

describe('compareVersions', () => {
  it.each([
    ['0.1.1', '0.1.1', 0],
    ['v0.1.1', '0.1.1', 0],
    ['0.2.0', '0.1.9', 1],
    ['0.1.9', '0.2.0', -1],
    ['1.0.0', '0.9.9', 1],
    ['0.1.2', '0.1', 1],
    ['0.1', '0.1.0', 0],
    ['10.0.0', '9.9.9', 1],
  ])('compareVersions(%s, %s) === %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});

describe('parseGithubRelease', () => {
  const payload = {
    tag_name: 'v0.2.0',
    name: 'v0.2.0 — fixes',
    published_at: '2026-08-26T10:00:00Z',
    body: '## Fixes\n- crash on open\n- **dark mode**',
    html_url: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.2.0',
    assets: [
      {
        name: 'HAnime1-0.2.0.apk',
        size: 77013559,
        browser_download_url: 'https://example.com/app.apk',
      },
      { name: 'HAnime1-0.2.0.ipa', browser_download_url: 'https://example.com/app.ipa' },
    ],
  };

  it('parses version (v stripped), release url and the apk asset', () => {
    expect(parseGithubRelease(payload)).toEqual({
      version: '0.2.0',
      releaseUrl: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.2.0',
      apkUrl: 'https://example.com/app.apk',
      name: 'v0.2.0 — fixes',
      publishedAt: '2026-08-26T10:00:00Z',
      notes: '## Fixes\n- crash on open\n- **dark mode**',
      apkSize: 77013559,
    });
  });

  it('returns apkUrl null when there is no apk asset', () => {
    const noApk = { ...payload, assets: [{ name: 'x.ipa', browser_download_url: 'u' }] };
    const parsed = parseGithubRelease(noApk);
    expect(parsed?.apkUrl).toBeNull();
    expect(parsed?.apkSize).toBeUndefined();
  });

  it('omits optional fields when the release has none', () => {
    const parsed = parseGithubRelease({ tag_name: '0.3.0', name: '   ', body: '' });
    expect(parsed?.name).toBeUndefined();
    expect(parsed?.notes).toBeUndefined();
    expect(parsed?.publishedAt).toBeUndefined();
  });

  it('falls back to the canonical release page when html_url is missing', () => {
    const parsed = parseGithubRelease({ tag_name: '0.3.0' });
    expect(parsed?.releaseUrl).toBe('https://github.com/ghostcoder42/hanime1/releases/latest');
  });

  it('rejects payloads without a numeric tag', () => {
    expect(parseGithubRelease({ tag_name: 'beta' })).toBeNull();
    expect(parseGithubRelease({ tag_name: undefined })).toBeNull();
    expect(parseGithubRelease(null)).toBeNull();
    expect(parseGithubRelease('string')).toBeNull();
  });
});

describe('stripMarkdown / truncateText', () => {
  it('flattens headings, emphasis, links and list bullets', () => {
    const md =
      '## What changed\nFixed [the bug](https://ex.com/a) and **crash** `on open`\n- item one\n- item two';
    expect(stripMarkdown(md)).toBe(
      'What changed\nFixed the bug and crash on open\n• item one\n• item two'
    );
  });

  it('normalizes CRLF so lines never glue together (GitHub body shape)', () => {
    // GitHub release notes come with \r\n line endings; stray \r made list
    // items render on one line in the Alert.
    const body =
      "## What's Changed\r\n* PR one by @user in https://ex.com/1\r\n* PR two by @user in https://ex.com/2";
    const out = stripMarkdown(body);
    expect(out).not.toContain('\r');
    expect(out).toBe(
      "What's Changed\n• PR one by @user in https://ex.com/1\n• PR two by @user in https://ex.com/2"
    );
  });

  it('truncates long text with an ellipsis and keeps short text intact', () => {
    expect(truncateText('abc', 10)).toBe('abc');
    expect(truncateText('a'.repeat(20), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

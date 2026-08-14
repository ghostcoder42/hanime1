import { compareVersions, parseGithubRelease } from './updates';

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
    html_url: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.2.0',
    assets: [
      { name: 'HAnime1-0.2.0.apk', browser_download_url: 'https://example.com/app.apk' },
      { name: 'HAnime1-0.2.0.ipa', browser_download_url: 'https://example.com/app.ipa' },
    ],
  };

  it('parses version (v stripped), release url and the apk asset', () => {
    expect(parseGithubRelease(payload)).toEqual({
      version: '0.2.0',
      releaseUrl: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.2.0',
      apkUrl: 'https://example.com/app.apk',
    });
  });

  it('returns apkUrl null when there is no apk asset', () => {
    const noApk = { ...payload, assets: [{ name: 'x.ipa', browser_download_url: 'u' }] };
    expect(parseGithubRelease(noApk)?.apkUrl).toBeNull();
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

import type { LatestRelease } from '@/lib/updates';
import { fireEvent, render } from '@testing-library/react-native';
import { UpdateDialog } from './update-dialog';

// The Modal tree flushes asynchronously through act(); on slow CI runners
// (2-core GitHub hosted machines, suites running in parallel) that can push
// a test past jest's default 5s timeout even though nothing is wrong — that
// is exactly how the first post-merge CI run failed while the PR run, local
// runs and every retry since have been green. Give this file headroom.
jest.setTimeout(15000);

const release: LatestRelease = {
  version: '0.3.0',
  releaseUrl: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.3.0',
  apkUrl: 'https://example.com/app.apk',
  name: 'v0.3.0 — big release',
  publishedAt: '2026-08-27T02:23:26Z',
  notes: "## What's Changed\r\n* Fix A\r\n* Fix B",
  apkSize: 52967745,
};

async function setup(overrides: Partial<Parameters<typeof UpdateDialog>[0]> = {}) {
  const onClose = jest.fn();
  const onDownload = jest.fn();
  const utils = await render(
    <UpdateDialog
      release={release}
      currentVersion="0.2.0"
      onClose={onClose}
      onDownload={onDownload}
      {...overrides}
    />
  );
  return { utils, onClose, onDownload };
}

describe('UpdateDialog', () => {
  it('renders nothing when there is no release', async () => {
    const { utils } = await setup({ release: null });
    expect(utils.toJSON()).toBeNull();
  });

  it('shows the release date, apk size, title and notes with proper line breaks', async () => {
    const { utils } = await setup();
    expect(utils.getByText('2026-08-27', { exact: false })).toBeTruthy();
    expect(utils.getByText(/APK ≈ 50\.5 MB/)).toBeTruthy();
    expect(utils.getByText('v0.3.0 — big release')).toBeTruthy();
    // CRLF normalized (per-line matching — the matcher folds newlines; the
    // exact \n layout is covered by the stripMarkdown unit tests)
    expect(utils.getByText(/What's Changed/)).toBeTruthy();
    expect(utils.getByText(/• Fix A/)).toBeTruthy();
    expect(utils.getByText(/• Fix B/)).toBeTruthy();
  });

  it('closes via cancel and hands the release to onDownload', async () => {
    const { utils, onClose, onDownload } = await setup();
    fireEvent.press(utils.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(utils.getByText('Update now'));
    expect(onDownload).toHaveBeenCalledWith(release);
  });
});

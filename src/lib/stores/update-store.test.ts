import { useUpdateStore } from './update-store';

// The root __mocks__/react-native-mmkv.ts backs storage with this shared map.
const mockStore = require('react-native-mmkv').__store as Record<string, string>;

beforeEach(() => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  useUpdateStore.setState({
    latestVersion: null,
    releaseUrl: null,
    apkUrl: null,
    lastCheckedAt: null,
  });
});

describe('useUpdateStore', () => {
  const release = {
    version: '0.2.0',
    releaseUrl: 'https://github.com/ghostcoder42/hanime1/releases/tag/v0.2.0',
    apkUrl: 'https://example.com/HAnime1-0.2.0.apk',
  };

  it('records a check and persists it under the update-check key', () => {
    useUpdateStore.getState().recordCheck(release, 1_700_000_000_000);

    const s = useUpdateStore.getState();
    expect(s.latestVersion).toBe('0.2.0');
    expect(s.apkUrl).toBe(release.apkUrl);
    expect(s.lastCheckedAt).toBe(1_700_000_000_000);
    // zustand persist wraps the payload as { state, version }.
    const persisted = JSON.parse(mockStore['update-check']);
    expect(persisted.version).toBe(0);
    expect(persisted.state).toMatchObject({
      latestVersion: '0.2.0',
      releaseUrl: release.releaseUrl,
      apkUrl: release.apkUrl,
      lastCheckedAt: 1_700_000_000_000,
    });
  });

  it('overwrites the previous check (one entry, latest wins)', () => {
    const { recordCheck } = useUpdateStore.getState();
    recordCheck(release, 1);
    recordCheck({ ...release, version: '0.3.0', apkUrl: null }, 2);

    const s = useUpdateStore.getState();
    expect(s.latestVersion).toBe('0.3.0');
    expect(s.apkUrl).toBeNull();
    expect(s.lastCheckedAt).toBe(2);
  });
});
